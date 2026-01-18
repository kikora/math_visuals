const { test, expect } = require('@playwright/test');

const { attachExamplesBackendMock } = require('./helpers/examples-backend-mock');
const { fillTaskDescription, openTaskDescriptionEditor } = require('./helpers/description-editor');

test.describe('task mode description preview', () => {
  let backend;

  test.beforeEach(async ({ page }) => {
    backend = await attachExamplesBackendMock(page.context());
  });

  test('renders preview in task mode and supports formatting', async ({ page }) => {
    await page.goto('/diagram/index.html', { waitUntil: 'load' });
    await openTaskDescriptionEditor(page);
    const preview = page.locator('.example-description-preview');

    await page.evaluate(() => window.mathVisuals.stopTaskDescriptionEdit());
    await expect(preview).toBeVisible();
    await expect(preview).toHaveText('');

    await fillTaskDescription(page, 'Vanlig tekst uten formatering');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveText('Vanlig tekst uten formatering');

    await fillTaskDescription(page, 'Vis @math{1 + 1} i teksten');
    await expect(preview).toBeVisible();
  });

  test('shows description text when switching to task mode', async ({ page }) => {
    await page.goto('/diagram/index.html', { waitUntil: 'load' });
    const description = 'Dette er en testoppgave';
    await fillTaskDescription(page, description);
    await page.evaluate(() => window.mathVisuals.setAppMode('task', { force: true }));
    const preview = page.locator('.example-description-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveText(description);

    const cfg = await page.evaluate(() => window.CFG);
    const htmlExample = [{
      descriptionHtml: '<p>Oppgave med <strong>fet</strong> tekst</p>',
      exampleNumber: '1',
      isDefault: true,
      config: { CFG: cfg }
    }];
    await backend.client.put('/diagram', { examples: htmlExample, deletedProvided: [] });
    await page.goto('/diagram/index.html?mode=oppgave', { waitUntil: 'load' });
    const htmlPreview = page.locator('.example-description-preview');
    await expect(htmlPreview).toBeVisible();
    await expect(htmlPreview).toHaveText('Oppgave med fet tekst');
  });

  test('renders math markup without exposing raw tokens in task mode', async ({ page }) => {
    await page.goto('/diagram/index.html', { waitUntil: 'load' });
    const description = 'Flytt punktene slik at linja gir @math{y=ax+b}.';
    await fillTaskDescription(page, description);
    await page.evaluate(() => window.mathVisuals.setAppMode('task', { force: true }));
    const preview = page.locator('.example-description-preview');
    await expect(preview).toBeVisible();
    await expect(preview).not.toContainText('@math');
    await expect(preview).toContainText(/y\s*=\s*ax\s*\+\s*b/);
  });

  test('renders KaTeX math and answer inputs in task mode', async ({ page }) => {
    await page.goto('/diagram/index.html', { waitUntil: 'load' });
    const description = 'Regn ut @math{\\tfrac{1}{2}} + @input[answer="7/12"|size="3"]';
    await fillTaskDescription(page, description);
    await page.evaluate(() => window.mathVisuals.setAppMode('task', { force: true }));

    const preview = page.locator('.example-description-preview');
    await expect(preview).toBeVisible();
    await expect(preview.locator('.math-vis-description-math .katex')).toHaveCount(1);

    const inputField = preview.locator('.math-vis-answerbox__input');
    await expect(inputField).toHaveCount(1);
    await expect(inputField).toHaveAttribute('size', '3');
  });

  test('renders simple fractions as proper fractions in task mode', async ({ page }) => {
    await page.goto('/diagram/index.html', { waitUntil: 'load' });
    await fillTaskDescription(page, 'Regn ut @math{1/2}');
    await page.evaluate(() => window.mathVisuals.setAppMode('task', { force: true }));

    const preview = page.locator('.example-description-preview');
    await expect(preview).toBeVisible();
    await expect(preview.locator('.math-vis-description-math .mfrac')).toHaveCount(1);
  });

  test('allows editing description from task mode toggle', async ({ page }) => {
    await page.goto('/diagram/index.html?mode=oppgave', { waitUntil: 'load' });

    const preview = page.locator('.example-description-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveText('');

    await page.locator('.example-description-toggle__button[data-mode="edit"]').click();

    const input = page.locator('#exampleDescription');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });
});

#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REGION=${DEFAULT_REGION:-eu-west-1}
DEFAULT_REDIS_VPC=${DEFAULT_REDIS_VPC:-vpc-083aa020e22000b94}

usage() {
  cat <<'USAGE'
Bruk: bash scripts/cloudshell-eni-check.sh [flagg]

Tilgjengelige flagg:
  --region=REGION      Regionen CloudShell-kallet skal bruke (standard: eu-west-1)
  --redis-vpc=VPC_ID   VPC-en der Redis finnes (standard: vpc-083aa020e22000b94)
  --trace              Slå på shell tracing for feilsøking
  -h, --help           Vis denne hjelpen

Skriptet forventer at du allerede er autentisert mot AWS (aws configure / aws sso login).
USAGE
}

REGION=$DEFAULT_REGION
REDIS_VPC=$DEFAULT_REDIS_VPC
TRACE=false
SHOW_HELP=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region=*)
      REGION="${1#*=}"
      ;;
    --redis-vpc=*)
      REDIS_VPC="${1#*=}"
      ;;
    --trace)
      TRACE=true
      ;;
    -h|--help)
      SHOW_HELP=true
      ;;
    *)
      echo "Ukjent flagg: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ "$SHOW_HELP" == true ]]; then
  usage
  exit 0
fi

if [[ "$TRACE" == true ]]; then
  set -x
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Kommandoen '$1' mangler i PATH. Installer den før du fortsetter." >&2
    exit 1
  fi
}

for cmd in aws jq; do
  require_cmd "$cmd"
done

status=0

cloudshell_matches=""

log_step() {
  local label="$1"
  local message="$2"
  echo "==> $label: $message"
}

find_cloudshell_interface() {
  local filters=("Name=interface-type,Values=api_gateway_cloud_shell" "Name=status,Values=available,in-use")
  local filter_description="interface-type=api_gateway_cloud_shell og status i [available,in-use]"

  if [[ -n "$REDIS_VPC" ]]; then
    filters+=("Name=vpc-id,Values=$REDIS_VPC")
    filter_description+=", vpc-id=$REDIS_VPC"
  fi

  local eni_json
  eni_json=$(aws ec2 describe-network-interfaces \
    --region "$REGION" \
    --filters "${filters[@]}" \
    --query "NetworkInterfaces[].{eni:NetworkInterfaceId,desc:Description,sgs:Groups[].GroupId,vpc:VpcId,subnet:SubnetId,az:AvailabilityZone,status:Status}" \
    --output json)

  cloudshell_matches="$eni_json"

  local match_count
  match_count=$(jq 'length' <<<"$eni_json")

  if [[ "$match_count" -eq 0 ]]; then
    echo "Fant ingen CloudShell-ENI-er med $filter_description i region $REGION. Prøver uten VPC-begrensning og med beskrivelsesmatch ..." >&2

    local fallback_filters=("Name=interface-type,Values=api_gateway_cloud_shell" "Name=status,Values=available,in-use")
    local desc_filters=("${fallback_filters[@]}" "Name=description,Values=*CloudShell*,*cloudshell*")

    eni_json=$(aws ec2 describe-network-interfaces \
      --region "$REGION" \
      --filters "${desc_filters[@]}" \
      --query "NetworkInterfaces[].{eni:NetworkInterfaceId,desc:Description,sgs:Groups[].GroupId,vpc:VpcId,subnet:SubnetId,az:AvailabilityZone,status:Status}" \
      --output json)

    match_count=$(jq 'length' <<<"$eni_json")

    if [[ "$match_count" -eq 0 ]]; then
      eni_json=$(aws ec2 describe-network-interfaces \
        --region "$REGION" \
        --filters "${fallback_filters[@]}" \
        --query "NetworkInterfaces[].{eni:NetworkInterfaceId,desc:Description,sgs:Groups[].GroupId,vpc:VpcId,subnet:SubnetId,az:AvailabilityZone,status:Status}" \
        --output json)

      match_count=$(jq 'length' <<<"$eni_json")
    fi

    cloudshell_matches="$eni_json"

    if [[ "$match_count" -eq 0 ]]; then
      echo "Fant ingen CloudShell-ENI-er i region $REGION selv uten VPC-filter." >&2
      return 1
    fi
  fi

  jq -c --arg vpc "$REDIS_VPC" '([.[] | select(.vpc == $vpc)][0]) // .[0]' <<<"$eni_json"
}

if ! cloudshell_entry=$(find_cloudshell_interface); then
  exit 2
fi

log_step "CloudShell-kandidater" "Fant $(jq 'length' <<<"$cloudshell_matches") ENI-er med interface-type api_gateway_cloud_shell"
echo "$cloudshell_matches" | jq -r '.[] | "- " + (.eni // "<ukjent>") + " (" + (.vpc // "<ukjent VPC>") + ", " + (.subnet // "<ukjent subnet>") + ", SGs=" + (((.sgs // []) | join(",") | select(length>0)) // "<ingen>") + ", status=" + (.status // "<ukjent>") + ")"'

eni_id=$(jq -r '.eni' <<<"$cloudshell_entry")
description=$(jq -r '.desc' <<<"$cloudshell_entry")
eni_vpc=$(jq -r '.vpc' <<<"$cloudshell_entry")
subnet_id=$(jq -r '.subnet' <<<"$cloudshell_entry")
sgs=$(jq -r '.sgs | join(",")' <<<"$cloudshell_entry")
status_str=$(jq -r '.status' <<<"$cloudshell_entry")
az=$(jq -r '.az' <<<"$cloudshell_entry")

log_step "CloudShell-ENI" "${eni_id} (${description:-<ingen beskrivelse>})"
echo "  VPC:    $eni_vpc"
echo "  Subnet: $subnet_id ($az)"
echo "  SGs:    ${sgs:-<ingen>}"
echo "  Status: $status_str"

if [[ "$eni_vpc" != "$REDIS_VPC" ]]; then
  echo "ENI-en ligger i VPC $eni_vpc, som ikke samsvarer med Redis-VPC $REDIS_VPC." >&2
  echo "Åpne CloudShell i riktig konto/VPC, eller test fra en EC2/bastion i Redis-VPC." >&2
  exit 3
fi

log_step "VPC-samsvar" "ENI ligger i Redis-VPC ($REDIS_VPC)"

log_step "Rutetabell" "Slår opp ruter for subnett $subnet_id"
rt_output=$(aws ec2 describe-route-tables \
  --filters Name=association.subnet-id,Values="$subnet_id" \
  --region "$REGION" \
  --output json)

if [[ $(echo "$rt_output" | jq -r '.RouteTables | length') -eq 0 ]]; then
  log_step "Rutetabell" "Ingen subnett-spesifikke ruter funnet; prøver VPC-ens hovedrute-tabell"
  rt_output=$(aws ec2 describe-route-tables \
    --filters Name=vpc-id,Values="$eni_vpc" Name=association.main,Values=true \
    --region "$REGION" \
    --output json)
fi

echo "$rt_output" | jq -r '.RouteTables[] | "- " + (.RouteTableId // "<ukjent>")'

reachable_routes=$(echo "$rt_output" | jq -r '.RouteTables[].Routes[] | select(.State=="active") | [.DestinationCidrBlock, .DestinationPrefixListId] | map(select(. != null)) | .[0] as $dest | {target: (.GatewayId // .NatGatewayId // .TransitGatewayId // .VpcPeeringConnectionId // .EgressOnlyInternetGatewayId // .NetworkInterfaceId // "local"), dest: $dest} | "  " + (.dest // "<ukjent destinasjon>") + " -> " + (.target // "<ukjent mål>")' | sed '/^  null/d')

if [[ -n "$reachable_routes" ]]; then
  echo "Aktive ruter:"
  echo "$reachable_routes"
else
  echo "Fant ingen aktive ruter i rutetabellen (kontroller subnett-assosiasjoner manuelt)."
fi

subnet_rt_output="$rt_output"
subnet_rt_count=$(echo "$subnet_rt_output" | jq -r '.RouteTables | length')

fallback_rt_output=""
fallback_rt_count=0

if [[ "$subnet_rt_count" -eq 0 ]]; then
  log_step "Rutetabell" "Ingen subnett-spesifikke ruter funnet; prøver VPC-ens hovedrute-tabell"
  fallback_rt_output=$(aws ec2 describe-route-tables \
    --filters Name=vpc-id,Values="$eni_vpc" Name=association.main,Values=true \
    --region "$REGION" \
    --output json)
  fallback_rt_count=$(echo "$fallback_rt_output" | jq -r '.RouteTables | length')
fi

evaluate_reachability() {
  local rt_json="$1"
  local label="$2"

  echo "$rt_json" | jq -r '.RouteTables[] | "- " + (.RouteTableId // "<ukjent>")'

  local reachable_routes
  reachable_routes=$(echo "$rt_json" | jq -r '.RouteTables[].Routes[] | select(.State=="active") | [.DestinationCidrBlock, .DestinationPrefixListId] | map(select(. != null)) | .[0] as $dest | {target: (.GatewayId // .NatGatewayId // .TransitGatewayId // .VpcPeeringConnectionId // .EgressOnlyInternetGatewayId // .NetworkInterfaceId // "local"), dest: $dest} | "  " + (.dest // "<ukjent destinasjon>") + " -> " + (.target // "<ukjent mål>")' | sed '/^  null/d')

  if [[ -n "$reachable_routes" ]]; then
    echo "Aktive ruter (${label}):"
    echo "$reachable_routes"
  else
    echo "Fant ingen aktive ruter i ${label} (kontroller subnett-assosiasjoner manuelt)."
  fi

  local routes_json
  routes_json=$(echo "$rt_json" | jq -c '[.RouteTables[].Routes[] | select(.State=="active") | {dest: (.DestinationCidrBlock // .DestinationIpv6CidrBlock // ""), target: (.GatewayId // .NatGatewayId // .TransitGatewayId // .VpcPeeringConnectionId // .EgressOnlyInternetGatewayId // .NetworkInterfaceId // "local")} ]')

  reachability_json=$(
    ROUTES="$routes_json" REDIS_CIDRS="$redis_subnet_cidrs_json" python - <<'PY'
import ipaddress
import json
import os

routes = json.loads(os.environ.get("ROUTES", "[]"))
redis_cidrs = json.loads(os.environ.get("REDIS_CIDRS", "[]"))

result = {"status": "fail", "reason": "Ingen Redis-CIDR-er funnet"}

allowed_prefixes = ("local", "nat-", "eni-", "igw-", "eigw-", "pcx-", "tgw-")

if redis_cidrs:
    for redis_cidr in redis_cidrs:
        try:
            redis_net = ipaddress.ip_network(redis_cidr)
        except ValueError:
            result = {"status": "fail", "reason": f"Ugyldig Redis-CIDR: {redis_cidr}"}
            break

        for route in routes:
            dest = (route.get("dest") or "").strip()
            target = (route.get("target") or "").strip()
            if not dest:
                continue

            try:
                dest_net = ipaddress.ip_network(dest, strict=False)
            except ValueError:
                continue

            if redis_net.subnet_of(dest_net) and any(
                target == prefix or target.startswith(prefix)
                for prefix in allowed_prefixes
            ):
                result = {
                    "status": "pass",
                    "redis_cidr": redis_cidr,
                    "route_dest": dest,
                    "target": target or "local",
                }
                break
        if result.get("status") == "pass":
            break
    else:
        result = {"status": "fail", "reason": "Ingen aktive ruter dekker Redis-subnettene"}

print(json.dumps(result))
PY
)

  reachability_status=$(echo "$reachability_json" | jq -r '.status')
  reachability_label="$label"
}

log_step "Redis-subnett" "Ser etter Redis-subnetter i VPC $eni_vpc"
mapfile -t redis_subnet_ids < <(
  aws elasticache describe-cache-subnet-groups --region "$REGION" --output json |
    jq -r ".CacheSubnetGroups[]? | select(.VpcId==\"${eni_vpc}\") | .Subnets[].SubnetIdentifier"
)

if [[ ${#redis_subnet_ids[@]} -eq 0 ]]; then
  echo "Fant ingen ElastiCache-subnettgrupper i VPC-en. Kontroller at Redis er satt opp i $eni_vpc." >&2
  status=1
else
  redis_subnet_cidrs_json=$(aws ec2 describe-subnets \
    --region "$REGION" \
    --subnet-ids "${redis_subnet_ids[@]}" \
    --query 'Subnets[].CidrBlock' \
    --output json)

  echo "Redis-subnett (CIDR):"
  echo "$redis_subnet_cidrs_json" | jq -r '.[] | "  - " + .'

  evaluate_reachability "$subnet_rt_output" "rutetabellen for subnett $subnet_id"

  if [[ "$subnet_rt_count" -eq 0 && "$fallback_rt_count" -gt 0 ]]; then
    log_step "Rutetabell" "Kjører rekkeviddesjekk mot VPC-ens hovedrute-tabell som subnettet arver"
    evaluate_reachability "$fallback_rt_output" "hovedrute-tabellen for VPC $eni_vpc"
  fi

  if [[ "$reachability_status" == "pass" ]]; then
    redis_cidr=$(echo "$reachability_json" | jq -r '.redis_cidr')
    route_dest=$(echo "$reachability_json" | jq -r '.route_dest')
    target=$(echo "$reachability_json" | jq -r '.target')
    echo "REACHABILITY (${reachability_label}): PASS – aktiv rute til $route_dest via $target dekker Redis-subnettet $redis_cidr."
  else
    reason=$(echo "$reachability_json" | jq -r '.reason')
    echo "REACHABILITY (${reachability_label}): FAIL – ${reason:-ukjent årsak}." >&2
    status=1
  fi
fi

log_step "Neste steg" "Hvis rutene ikke peker mot Redis-subnettene eller en NAT/IGW som når dem, flytt CloudShell til et subnett med riktige ruter eller oppdater rutetabellen. Kjør deretter redis-cli --tls ... PING på nytt."

exit "$status"

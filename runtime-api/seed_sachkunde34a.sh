#!/bin/bash

TOKEN=$(curl -s -X POST http://127.0.0.1:8080/auth/login \
-H "Content-Type: application/json" \
-d '{"username":"berufsbildung-admin","password":"rsos_secure_2026"}' \
| jq -r '.token')

create_module() {

ID="$1"
TITLE="$2"
UE="$3"

curl -s -X POST \
-H "Authorization: Bearer $TOKEN" \
-H "Content-Type: application/json" \
-d "{
  \"knowledge_id\":\"$ID\",
  \"knowledge_type\":\"learning_module\",
  \"parent_knowledge_id\":\"kp-sachkunde34a\",
  \"title\":\"$TITLE\",
  \"description\":\"Empfohlener Umfang: $UE UE\",
  \"language_code\":\"de\",
  \"content\":{
    \"recommended_ue\":\"$UE\"
  }
}" \
http://127.0.0.1:8080/runtime/knowledge >/dev/null

echo "Created: $TITLE"
}

create_module "km-oeffentliche-sicherheit" "Recht der öffentlichen Sicherheit und Ordnung" "12-16"
create_module "km-gewerberecht" "Gewerberecht" "4-8"
create_module "km-datenschutz" "Datenschutzrecht" "4-6"
create_module "km-bgb" "Bürgerliches Gesetzbuch (BGB)" "16-20"
create_module "km-stgb" "Straf- und Strafverfahrensrecht" "16-20"
create_module "km-waffenrecht" "Umgang mit Waffen" "2-4"
create_module "km-dguv" "Unfallverhütungsvorschriften" "6-8"
create_module "km-umgang-menschen" "Umgang mit Menschen und Deeskalation" "12-16"
create_module "km-sicherheitstechnik" "Grundzüge der Sicherheitstechnik" "6-8"

echo "Sachkunde §34a Module erstellt."

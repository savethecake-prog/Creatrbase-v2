# Run from C:\Users\savet\creatrbase-v2
# Copies existing SQL migrations and AI prompts from the vault into the project

$vault = "C:\Users\savet\Desktop\Work Brain\Work Brain\Software Projects\Creatrbase"
$project = "C:\Users\savet\creatrbase-v2"

# SQL migrations
Copy-Item "$vault\001_create_tenants_users.sql"    "$project\migrations\"
Copy-Item "$vault\002_create_creators_platforms.sql" "$project\migrations\"
Copy-Item "$vault\003_create_brand_registry.sql"   "$project\migrations\"
Copy-Item "$vault\004_create_tasks_recommendations.sql" "$project\migrations\"
Copy-Item "$vault\005_create_experiments.sql"      "$project\migrations\"
Copy-Item "$vault\006_create_toolkit.sql"          "$project\migrations\"
Copy-Item "$vault\007_create_billing.sql"          "$project\migrations\"
Copy-Item "$vault\008_create_admin.sql"            "$project\migrations\"
Copy-Item "$vault\009_create_knowledge_layer.sql"  "$project\migrations\"
Copy-Item "$vault\010_seed_reference_data.sql"     "$project\migrations\"
Copy-Item "$vault\010_seed_brand_registry.sql"     "$project\migrations\"

# AI prompts
Copy-Item "$vault\files\niche-classification-v1.txt"         "$project\src\prompts\"
Copy-Item "$vault\files\task-generation-gap-closure-v1.txt"  "$project\src\prompts\"
Copy-Item "$vault\files\task-generation-maintenance-v1.txt"  "$project\src\prompts\"
Copy-Item "$vault\files\recommendation-generation-v1.txt"   "$project\src\prompts\"
Copy-Item "$vault\files\rate-inference-explanation-v1.txt"   "$project\src\prompts\"
Copy-Item "$vault\files\negotiation-draft-v1.txt"            "$project\src\prompts\"
Copy-Item "$vault\files\knowledge-synthesis-v1.txt"          "$project\src\prompts\"
Copy-Item "$vault\files\pattern-mining-v1.txt"               "$project\src\prompts\"

Write-Host "Done. Check migrations/ and src/prompts/"

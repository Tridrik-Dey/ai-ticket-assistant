$baseUrl = 'http://127.0.0.1:3000'

function Assert-HttpCode([string]$Uri) {
  try {
    $code = curl.exe -s -o NUL -w "%{http_code}" "$Uri"
    Write-Host "$Uri => $code"
    return $code -eq '200'
  } catch {
    Write-Host "$Uri => ERROR $($_.Exception.Message)"
    return $false
  }
}

$ok = $true
$ok = $ok -and (Assert-HttpCode "$baseUrl/api/tickets")
$ok = $ok -and (Assert-HttpCode "$baseUrl/tickets")

$payload = @{
  subject = 'Cannot login to my account'
  description = 'I reset my password twice but still get invalid credentials.'
  customerName = 'John Doe'
  customerEmail = 'john.doe@example.com'
} | ConvertTo-Json

try {
  $created = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/tickets" -Headers @{ 'Content-Type' = 'application/json' } -Body $payload
  Write-Host "Created ticket: $($created.id)"

  $classifyBody = @{
    ticketId = $created.id
    subject = $created.subject
    description = $created.description
  } | ConvertTo-Json

  $classified = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/classify-ticket" -Headers @{ 'Content-Type' = 'application/json' } -Body $classifyBody
  Write-Host "Classified: $($classified.category) / $($classified.priority)"

  $tickets = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/tickets"
  $found = $tickets | Where-Object { $_.id -eq $created.id }
  if ($found -and $found.category -and $found.priority -and $found.issueSummary -and $found.suggestedResponse) {
    Write-Host 'Persistence check: PASS (stored classification on ticket)'
  } else {
    Write-Host 'Persistence check: FAIL (missing classification fields)'
    $ok = $false
  }
} catch {
  Write-Host "Runtime API step failed: $($_.Exception.Message)"
  $ok = $false
}

if ($ok) { Write-Host 'SMOKE TEST: PASS' } else { Write-Host 'SMOKE TEST: FAIL' }
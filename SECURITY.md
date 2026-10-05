# Security policy

## Reporting a vulnerability

Please do not open a public issue for a vulnerability or suspected data exposure. Use GitHub's private vulnerability reporting feature for this repository.

Include the affected component, reproduction steps, likely impact and any suggested mitigation. Do not include real credentials, personal data or production records in a report.

## Repository safety

Production credentials, signing keys, provider configuration, private network details and user uploads must stay outside Git. Use local environment files or the deployment host's protected configuration store. Tracked environment files are templates and must contain placeholders only.

The release workflow scans the current tree for private operational metadata and scans complete reachable Git history with Gitleaks.

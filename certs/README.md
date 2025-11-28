# SSL/TLS Certificates

This directory contains SSL/TLS certificates and private keys for HTTPS support.

## Files

- `banksim.ca.key` - Private key (DO NOT SHARE OR COMMIT)
- `banksim.ca.csr` - Certificate Signing Request (safe to share with CA)
- `banksim.ca.crt` - Signed certificate (place here after receiving from CA)

## Getting a Signed Certificate

1. **CSR Already Generated**: The Certificate Signing Request (`banksim.ca.csr`) has been generated as a **wildcard certificate** with the following details:
   - Common Name (CN): *.banksim.ca
   - Subject Alternative Names (SANs): *.banksim.ca, banksim.ca, localhost
   - Organization: BSIM Banking Simulator
   - Location: Toronto, Ontario, CA
   - **Covers all subdomains**: api.banksim.ca, www.banksim.ca, dev.banksim.ca, etc.

2. **Submit CSR to Certificate Authority**:
   - Copy the contents of `banksim.ca.csr`
   - Submit to your CA (e.g., Let's Encrypt, DigiCert, etc.)
   - The CSR can be viewed with: `openssl req -text -noout -in banksim.ca.csr`

3. **Install Signed Certificate**:
   - Once you receive the signed certificate from the CA, save it as `banksim.ca.crt`
   - If the CA provides intermediate certificates, you may need to create a certificate chain:
     ```bash
     cat banksim.ca.crt intermediate.crt > banksim.ca.crt
     ```

4. **Restart Servers**: After placing the certificate, restart both backend and frontend servers

## Development Certificate (Temporary)

For local development before getting a signed certificate, you can use a self-signed certificate:

```bash
# Generate self-signed wildcard certificate (valid for 365 days)
openssl x509 -req -days 365 -in banksim.ca.csr -signkey banksim.ca.key -out banksim.ca.crt \
  -extfile <(printf "subjectAltName=DNS:*.banksim.ca,DNS:banksim.ca,DNS:localhost")
```

**Note**: Self-signed certificates will show security warnings in browsers and are not suitable for production.

## Security

- The `banksim.ca.key` private key file is excluded from git via `.gitignore`
- Never commit private keys to version control
- Keep the private key secure and restrict file permissions: `chmod 600 banksim.ca.key`

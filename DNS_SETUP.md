# DNS Configuration for knowingjesusdaily.com

## Current Setup
- **CNAME file**: `www.knowingjesusdaily.com` (GitHub Pages custom domain)
- **Issue**: Visiting `knowingjesusdaily.com` (without `www`) shows an SSL/security warning

## Problem
The bare domain (`knowingjesusdaily.com`) is not configured to point to GitHub Pages servers. Without proper DNS records, the browser cannot establish a secure HTTPS connection and shows a warning.

## Fix: Add DNS Records at Your Domain Registrar

Log into your domain registrar (e.g., GoDaddy, Namecheap, Cloudflare, etc.) and configure these records:

### 1. A Records for bare domain (`knowingjesusdaily.com`)

Add **four** A records pointing to GitHub Pages IP addresses:

| Type | Name | Value |
|------|------|-------|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

### 2. CNAME Record for www subdomain

Ensure this record exists:

| Type | Name | Value |
|------|------|-------|
| CNAME | www | afbiobs.github.io |

### 3. Enable "Enforce HTTPS" in GitHub

1. Go to the repository **Settings** > **Pages**
2. Under "Custom domain", verify `www.knowingjesusdaily.com` is set
3. Check the **"Enforce HTTPS"** checkbox (if not already enabled)

## Result

Once DNS changes propagate (can take up to 48 hours):
- `https://www.knowingjesusdaily.com` - serves the site with valid SSL
- `https://knowingjesusdaily.com` - automatically redirects to `https://www.knowingjesusdaily.com` with valid SSL
- No more browser security warnings

## Verification

After DNS propagation, test with:
```
curl -I https://knowingjesusdaily.com
```
You should see a `301` redirect to `https://www.knowingjesusdaily.com`.

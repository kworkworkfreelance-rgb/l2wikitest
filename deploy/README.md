Deployment checklist for L2Wiki

These are safe, minimal steps to apply the nginx site config I added and verify connectivity.

1. Copy the config to the server (on the server run):

```bash
sudo cp deploy/nginx/l2wiki.conf /etc/nginx/sites-available/l2wiki
sudo ln -sfn /etc/nginx/sites-available/l2wiki /etc/nginx/sites-enabled/l2wiki
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

2. Verify Node service and nginx process:

```bash
sudo systemctl status l2wiki --no-pager
sudo journalctl -u l2wiki -n 200 --no-pager
sudo systemctl status nginx --no-pager
sudo journalctl -u nginx -n 200 --no-pager
```

3. Confirm listeners (ports):

```bash
# lists listening tcp ports and processes
sudo ss -tlnp | grep -E ':80|:443|:3000' || sudo netstat -tulpn | grep -E ':80|:443|:3000'
```

- `:3000` should show `node` (the `l2wiki` service).
- `:80` should show `nginx` listening on 0.0.0.0 and/or [::].

4. Check firewall (UFW) and cloud-provider firewalls:

```bash
sudo ufw status verbose
# If active, allow web traffic:
sudo ufw allow 'Nginx Full'    # opens 80 and 443
# Or specifically:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

If you're using a cloud provider-managed firewall (DigitalOcean, AWS Security Group, etc.), ensure port 80/443 are allowed there.

5. Check DNS and resolve from your workstation and server:

```bash
# from the server
dig +short l2wiki.su
# from your workstation (Windows):
nslookup l2wiki.su
```

- The A (or AAAA) record must point to the server's public IP. If the domain does not resolve, update your DNS provider.

6. Quick curl tests (from the server):

```bash
# local Node
curl -v http://127.0.0.1:3000
# via nginx (local)
curl -v http://127.0.0.1/
# via public IP (replace <IP>)
curl -v http://<your-public-ip>/
```

If `curl http://127.0.0.1:3000` returns HTML (as you showed), Node is healthy. If `curl http://127.0.0.1/` returns connection refused, nginx is not listening or firewall blocks.

7. Logs to inspect when connections are refused:

```bash
sudo journalctl -u nginx -n 500 --no-pager
sudo tail -n 200 /var/log/nginx/error.log
sudo journalctl -u l2wiki -n 200 --no-pager
```

8. IPv6 note:

If your DNS AAAA record points to an IPv6 address but nginx is not listening on IPv6, you'll see connection refused. The supplied config includes `listen [::]:80;` to cover IPv6; ensure nginx was reloaded after applying it.

9. When ready, restart or reload services:

```bash
sudo systemctl daemon-reload
sudo systemctl restart l2wiki
sudo systemctl restart nginx
```

10. If you want, I can also prepare a simple `systemd` unit file example and an HTTPS (Certbot) snippet.

-- End of checklist

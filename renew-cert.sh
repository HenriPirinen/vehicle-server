#!/bin/bash
sudo systemctl stop regni-server.service
openssl genrsa -out regni-key.pem 2048
openssl req -new -sha256 -key regni-key.pem -out regni-csr.pem
openssl x509 -req -in regni-csr.pem -signkey regni-key.pem -out regni-cert.pem
sudo systemctl start regni-server.service

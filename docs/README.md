# BSIM Documentation

This directory contains technical documentation for the BSIM banking simulation platform and its ecosystem.

## Payment Flows

Detailed sequence diagrams and API documentation for payment processing.

| Document | Description |
|----------|-------------|
| [P2P Transfer Flow](FLOW_P2P_TRANSFER.md) | Cross-bank peer-to-peer transfers via TransferSim |
| [Micro Merchant Payments](FLOW_MICRO_MERCHANT.md) | QR code and BLE proximity payments with fee collection |
| [Card Payment Flow](FLOW_CARD_PAYMENT.md) | E-commerce card payments via NSIM network |
| [BLE Proximity Discovery](FLOW_BLE_DISCOVERY.md) | Bluetooth beacon-based recipient discovery |

## Deployment & Infrastructure

Guides for deploying BSIM in various environments.

| Document | Description |
|----------|-------------|
| [AWS Deployment](AWS_DEPLOYMENT.md) | EC2, ECS Fargate, RDS, and ALB configuration |
| [Docker SSL Setup](DOCKER_SSL_SETUP.md) | HTTPS configuration with wildcard certificates |
| [Backend Setup](BACKEND_SETUP.md) | Local development environment setup |

## API Specifications

Machine-readable API documentation following industry standards.

| Document | Description |
|----------|-------------|
| [API Specs Overview](API_SPECS_README.md) | Guide to OpenAPI and AsyncAPI specifications |
| [openapi.yaml](openapi.yaml) | OpenAPI 3.1 specification for REST endpoints |
| [asyncapi.yaml](asyncapi.yaml) | AsyncAPI 3.0 specification for webhooks/events |

## Integration Guides

Documentation for integrating with BSIM ecosystem services.

| Document | Description |
|----------|-------------|
| [WSIM Embedded Enrollment](WSIM_EMBEDDED_ENROLLMENT_IMPLEMENTATION.md) | Card enrollment iframe integration |
| [Payment Network Plan](PAYMENT_NETWORK_PLAN.md) | NSIM payment network architecture |

## Ecosystem Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BSIM ECOSYSTEM                                    │
└─────────────────────────────────────────────────────────────────────────────┘

                                 ┌─────────┐
                                 │  mwsim  │
                                 │ (Mobile)│
                                 └────┬────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
              ┌─────────┐       ┌─────────┐       ┌─────────┐
              │  WSIM   │       │TransferSim      │  SSIM   │
              │(Wallet) │       │ (P2P Net)│      │ (Store) │
              └────┬────┘       └────┬────┘       └────┬────┘
                   │                 │                 │
                   │                 │                 │
         ┌─────────┴─────────┐       │          ┌──────┴──────┐
         │                   │       │          │             │
         ▼                   ▼       ▼          ▼             │
   ┌─────────┐         ┌─────────┐ ┌─────────┐ ┌─────────┐    │
   │  BSIM   │         │ NewBank │ │  BSIM   │ │  NSIM   │<───┘
   │ (Bank)  │         │ (Bank)  │ │ (Bank)  │ │(Network)│
   └─────────┘         └─────────┘ └─────────┘ └────┬────┘
                                                    │
                                                    ▼
                                              ┌─────────┐
                                              │  BSIM   │
                                              │(Issuer) │
                                              └─────────┘
```

### Component Summary

| Component | Purpose | Repository |
|-----------|---------|------------|
| **BSIM** | Core banking API (accounts, cards, transactions) | This repo |
| **NewBank** | Second BSIM instance for multi-bank testing | This repo (config) |
| **WSIM** | Digital wallet backend (card enrollment, auth) | [wsim](https://github.com/jordancrombie/wsim) |
| **mwsim** | Mobile wallet app (iOS/Android) | [mwsim](https://github.com/jordancrombie/mwsim) |
| **TransferSim** | P2P transfer network | [transferSim](https://github.com/jordancrombie/transferSim) |
| **SSIM** | E-commerce store simulator | [ssim](https://github.com/jordancrombie/ssim) |
| **NSIM** | Card payment network | [nsim](https://github.com/jordancrombie/nsim) |

## Quick Links

### Production URLs

| Service | URL |
|---------|-----|
| BSIM Frontend | https://banksim.ca |
| BSIM Admin | https://admin.banksim.ca |
| BSIM API | https://banksim.ca/api |
| NewBank Frontend | https://newbank.banksim.ca |
| WSIM | https://wsim.banksim.ca |
| TransferSim | https://transfer.banksim.ca |

### Development URLs

| Service | URL |
|---------|-----|
| BSIM Frontend | https://dev.banksim.ca |
| BSIM Admin | https://admin-dev.banksim.ca |
| NewBank Frontend | https://newbank-dev.banksim.ca |

## Contributing

When adding new documentation:

1. Use descriptive filenames with `SCREAMING_SNAKE_CASE.md`
2. Include ASCII diagrams for flows where applicable
3. Add API request/response examples
4. Link to related documentation
5. Update this README index

## Assets

| File | Description |
|------|-------------|
| [images/bsim-logo.png](images/bsim-logo.png) | BSIM logo for documentation |

# BLE Proximity Discovery Flow

Bluetooth Low Energy beacon-based recipient discovery for contactless P2P transfers and merchant payments.

## Overview

BLE Proximity Discovery allows users to find nearby payment recipients without typing aliases or scanning QR codes. Users broadcast their identity as an iBeacon signal, and nearby senders can discover and initiate transfers.

## Components

| Component | Role |
|-----------|------|
| **mwsim (Receiver)** | Broadcasts iBeacon with user token |
| **mwsim (Sender)** | Scans for nearby beacons |
| **WSIM** | Resolves tokens to user profiles |
| **TransferSim** | Processes the transfer |

## Use Cases

| Mode | Description |
|------|-------------|
| **P2P Receive** | User broadcasts to receive money from friends |
| **Merchant Mode** | Business broadcasts to accept payments |
| **Split Bill** | Multiple receivers broadcast for group payments |

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     BLE PROXIMITY DISCOVERY                                  │
│                  (Contactless P2P Initiation)                                │
└──────────────────────────────────────────────────────────────────────────────┘

   RECEIVER (Broadcasting)                      SENDER (Scanning)
  ┌──────────────────────┐                    ┌──────────────────────┐
  │        mwsim         │                    │        mwsim         │
  │   "Ready to Receive" │                    │   "Send Money"       │
  └──────────┬───────────┘                    └──────────┬───────────┘
             │                                           │
             │  1. Start iBeacon                         │
             │     Broadcast                             │
             │     ════════════════                      │
             │     UUID: TransferSim                     │
             │     Major: bank_id                        │
             │     Minor: user_token                     │
             │                                           │
             │        ~~~~ BLE Signal ~~~~               │
             │ )) )) )) )) )) )) )) )) )) )) )) )) )) )) │
             │                                           │
             │                                           │ 2. Scan for
             │                                           │    iBeacons
             │                                           │
             │                                           ▼
             │                                    ┌─────────────┐
             │                                    │  Discovered │
             │                                    │  Receivers: │
             │                                    │             │
             │                                    │  📱 @alice  │
             │                                    │     ~2m     │
             │                                    │             │
             │                                    │  📱 @bob    │
             │                                    │     ~5m     │
             │                                    └──────┬──────┘
             │                                           │
             │                                           │ 3. Select
             │                                           │    Recipient
             │                                           ▼
             │                                    ┌─────────────┐
             │                                    │ Enter Amount│
             │                                    │   $50.00    │
             │                                    │   [SEND]    │
             │                                    └──────┬──────┘
             │                                           │
             │                                           │ 4. Initiate
             │                                           │    Transfer
             │                                           ▼
             │                                    ┌─────────────┐
             │                                    │    WSIM     │
             │                                    │   Backend   │
             │                                    └──────┬──────┘
             │                                           │
             │         ┌─────────────────────────────────┤
             │         │                                 │
             │         ▼                                 │
             │  ┌─────────────┐                          │
             │  │ TransferSim │<─────────────────────────┘
             │  │  (Network)  │  5. POST /transfer
             │  └──────┬──────┘     {recipient_token}
             │         │
             │         │ 6. Process Transfer
             │         │    (See P2P Flow)
             │         │
             ▼         ▼
       ┌───────────────────────┐
       │   Push Notifications  │
       │                       │
       │  Receiver: "Received  │
       │   $50 from @sender"   │
       │                       │
       │  Sender: "Sent $50    │
       │   to @receiver"       │
       └───────────────────────┘
```

## iBeacon Format

### UUID Structure

All TransferSim BLE beacons use a common UUID:

```
UUID: E2C56DB5-DFFB-48D2-B060-D0F5A71096E0
      └─────────── TransferSim Identifier ──────────┘
```

### Major/Minor Values

| Field | Bits | Description |
|-------|------|-------------|
| **Major** | 16-bit | Bank identifier |
| **Minor** | 16-bit | Encoded user token |

```
Major Values:
  0x0001 = BSIM
  0x0002 = NewBank
  0x0003 = (Reserved)

Minor Values:
  Encoded from user's BLE token (rotates every 15 minutes)
```

## Step-by-Step

### 1. Receiver Starts Broadcasting

User opens mwsim and enters "Receive" mode.

```swift
// iOS - Start broadcasting
let region = CLBeaconRegion(
    uuid: UUID(uuidString: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0")!,
    major: 0x0001,  // BSIM
    minor: userToken,
    identifier: "TransferSim"
)
peripheralManager.startAdvertising(beaconData)
```

```kotlin
// Android - Start broadcasting
val beacon = Beacon.Builder()
    .setId1("E2C56DB5-DFFB-48D2-B060-D0F5A71096E0")
    .setId2("1")  // BSIM
    .setId3(userToken.toString())
    .setManufacturer(0x004C)  // Apple iBeacon format
    .build()
beaconTransmitter.startAdvertising(beacon)
```

### 2. Sender Scans for Beacons

User opens mwsim "Send" screen and enables proximity discovery.

```swift
// iOS - Start scanning
let region = CLBeaconRegion(
    uuid: UUID(uuidString: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0")!,
    identifier: "TransferSim"
)
locationManager.startRangingBeacons(satisfying: region)
```

### 3. Resolve Discovered Users

For each discovered beacon, resolve to user profile:

```json
// mwsim -> WSIM
POST /api/ble/resolve
{
  "beacons": [
    {
      "major": 1,
      "minor": 12345,
      "rssi": -45,
      "accuracy": 1.5
    },
    {
      "major": 2,
      "minor": 67890,
      "rssi": -62,
      "accuracy": 4.2
    }
  ]
}

// Response
{
  "users": [
    {
      "beacon_key": "1:12345",
      "user_id": "user_alice",
      "display_name": "Alice Smith",
      "avatar_url": "https://cdn.banksim.ca/avatars/alice.jpg",
      "bank_id": "bsim",
      "distance_meters": 1.5,
      "is_merchant": false
    },
    {
      "beacon_key": "2:67890",
      "user_id": "user_bob",
      "display_name": "Bob's Coffee Shop",
      "avatar_url": "https://cdn.banksim.ca/logos/bobs-coffee.jpg",
      "bank_id": "newbank",
      "distance_meters": 4.2,
      "is_merchant": true
    }
  ]
}
```

### 4. Select Recipient and Send

User selects recipient from list and enters amount.

### 5-6. Process Transfer

Standard P2P or Merchant flow via TransferSim.

See:
- [P2P Transfer Flow](FLOW_P2P_TRANSFER.md)
- [Micro Merchant Flow](FLOW_MICRO_MERCHANT.md)

## Token Rotation

BLE tokens rotate periodically for privacy:

| Setting | Value |
|---------|-------|
| Rotation Interval | 15 minutes |
| Token Lifetime | 30 minutes (overlap for discovery) |
| Algorithm | HMAC-SHA256(user_id + timestamp + secret) |

```json
// WSIM generates rotating tokens
GET /api/ble/token

{
  "token": 12345,
  "bank_id": 1,
  "expires_at": "2024-01-15T12:30:00Z",
  "next_token": 12346,
  "next_token_at": "2024-01-15T12:15:00Z"
}
```

## Distance Estimation

RSSI (signal strength) is converted to approximate distance:

```javascript
function estimateDistance(rssi, txPower = -59) {
  if (rssi === 0) return -1;

  const ratio = rssi / txPower;
  if (ratio < 1.0) {
    return Math.pow(ratio, 10);
  } else {
    return 0.89976 * Math.pow(ratio, 7.7095) + 0.111;
  }
}

// RSSI -45 → ~1.5 meters
// RSSI -62 → ~4.2 meters
// RSSI -75 → ~10+ meters
```

## UI/UX Guidelines

### Receiver Screen

```
┌─────────────────────────────────────┐
│         Ready to Receive            │
│                                     │
│         ┌───────────────┐           │
│         │               │           │
│         │   )) )) ))    │           │
│         │               │           │
│         │  Broadcasting │           │
│         │               │           │
│         └───────────────┘           │
│                                     │
│  Your alias: @alice                 │
│  Bank: BSIM                         │
│                                     │
│  Nearby users can now find you      │
│  and send you money.                │
│                                     │
│         [Stop Broadcasting]         │
└─────────────────────────────────────┘
```

### Sender Discovery Screen

```
┌─────────────────────────────────────┐
│         Nearby Recipients           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 👤 Alice Smith        ~2m   │   │
│  │    @alice • BSIM            │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ☕ Bob's Coffee       ~4m   │   │
│  │    @bobscoffee • NewBank    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 👤 Charlie            ~8m   │   │
│  │    @charlie • BSIM          │   │
│  └─────────────────────────────┘   │
│                                     │
│         [Scan QR Instead]           │
└─────────────────────────────────────┘
```

## Privacy Considerations

| Feature | Implementation |
|---------|---------------|
| Token Rotation | Prevents long-term tracking |
| Opt-in Broadcasting | Users must explicitly enable |
| Range Limiting | Only show users within ~10m |
| No Location Sharing | Only relative distance shown |

## Platform Requirements

### iOS

- iOS 13.0+
- CoreLocation permission (Always or When In Use)
- Bluetooth permission
- Background modes: `bluetooth-central`, `bluetooth-peripheral`

### Android

- Android 8.0+ (API 26)
- `BLUETOOTH_ADVERTISE` permission (Android 12+)
- `BLUETOOTH_SCAN` permission (Android 12+)
- `ACCESS_FINE_LOCATION` permission
- BLE advertising support required

## Battery Optimization

| Strategy | Description |
|----------|-------------|
| Adaptive Intervals | Reduce broadcast frequency when stationary |
| Auto-stop | Stop broadcasting after 5 minutes of inactivity |
| Background Limits | Reduce scan frequency in background |
| Screen-aware | Full power only when app is foregrounded |

## API Endpoints

### WSIM

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ble/token` | GET | Get current BLE token |
| `/api/ble/resolve` | POST | Resolve beacons to users |
| `/api/ble/status` | GET | Check BLE broadcast status |

## Troubleshooting

### Beacon Not Discovered

1. Check Bluetooth is enabled on both devices
2. Verify location permissions granted
3. Ensure devices are within range (~10m)
4. Check for physical obstructions

### Wrong User Resolved

1. Token may have rotated - refresh and retry
2. Check timestamp synchronization
3. Verify bank_id matches expected

### High Battery Drain

1. Reduce broadcast interval
2. Enable auto-stop timeout
3. Limit background scanning

## Related Documentation

- [P2P Transfer Flow](FLOW_P2P_TRANSFER.md) - Transfer processing
- [Micro Merchant Flow](FLOW_MICRO_MERCHANT.md) - Merchant payments
- [mwsim Setup](../mwsim/README.md) - Mobile app configuration

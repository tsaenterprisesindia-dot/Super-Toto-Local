# Google Play — Data Safety Form (Answers)

Fill these in Play Console: **App content → Data safety**.

Use the **hosted Privacy Policy URL** and answer truthfully to what the build actually does.

---

## 1. Does your app collect or share any of the required user data types?
**Yes**

Declared data types collected by Super Toto Local:

| Category | Data type | Collected | Shared | Processed (server-only) | Is it required? |
|---|---|---|---|---|---|
| **Personal info** | Name | ✅ | ❌ | — | ✅ Yes |
| **Personal info** | Email address | ✅ | ❌ | — | ✅ Yes |
| **Personal info** | Phone number | ✅ | ❌ | — | ✅ Yes |
| **Personal info** | Other user-generated content (trip addresses, reviews, cancellation notes) | ✅ | ❌ | — | ✅ Yes |
| **Personal info** | Other personal info (Aadhaar, driving licence, bank/RC/insurance/PUC/PCC documents, driver photo) | ✅ | ❌ | — | ✅ Yes |
| **Financial info** | Purchase history (trip fares & payments) | ✅ | ❌ | — | ✅ Yes |
| **Financial info** | Credit/debit card or other payment info | ❌ | ❌ | — | — |
| **Location** | Approximate location | ✅ | ❌ | — | ❌ No (coarse stats only) |
| **Location** | Precise location | ✅ | ✅ (to assigned driver during active ride) | — | ❌ No |
| **Photos & media** | Photos (driver passport photo, documents) | ✅ | ❌ | — | ✅ Yes |
| **Photos & media** | Videos | ❌ | ❌ | — | — |
| **Device or other IDs** | Device or other IDs | ✅ | ❌ | — | ❌ No |

> **Sharing with assigned driver:** precise pickup/drop location and the rider's name & phone are shown to the assigned driver only for the duration of a booked trip. Mark this as "shared with the assigned driver for trip fulfilment" if you answer yes on sharing.

---

## 2. Is all of the user data collected on-device and not transmitted?
**No** — data is transmitted to the operator's server to provide the service.

---

## 3. Do you have a data deletion mechanism?
**Yes** — riders/drivers can request account deletion from Profile, and it is processed by the Grievance Officer / admin.

---

## 4. Data handling

### Your app collects and transmits data. For each data type selected:
- **Is this data encrypted in transit?** — **Yes** (HTTPS; note: the **debug/dev** build uses cleartext `http://127.0.0.1:5000` for local testing only — see `network_security_config.xml`. The Play upload **MUST** use the release build where this is disabled/restricted).
- **Do you provide a way for users to request that data be deleted?** — **Yes** (Profile → request deletion).
- **Is this data processed ephemerally?** — **No** (retained per the retention policy) — except **Precise location** outside an active ride, and coarse analytics, which can be marked ephemeral if desired.

### Does your app offer a way for users to request that their data be deleted?
**Yes**

---

## 5. Security practices
- **Is data encrypted in transit?** — **Yes** (HTTPS in release builds)
- **Is data encrypted at rest?** — **Yes** (hashed passwords, minimised/encrypted sensitive storage as documented)
- **Is there a data deletion mechanism?** — **Yes**

---

## 6. Kids' declaration
- **Does your app comply with Google Play's Families policy?** — **No** — the app is not directed at children under 13 and is not for a child audience.

---

## 7. Government app / health / financial eligibility
- Not a government app, not a health app, not a financial-services app.

---

## Data safety — recommended console selections
1. Category → **Personal info**: Name, Email address, Phone number, Other user-generated content, Other personal info.
2. Category → **Financial info**: Purchase history.
3. Category → **Location**: Approximate location, Precise location.
4. Category → **Photos & media**: Photos.
5. Category → **Device or other IDs**: Device or other IDs.
6. Encr in transit **Yes**; data deletion mechanism **Yes**; encr at rest **Yes**.
7. Not for children.

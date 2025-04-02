# PrayU-Api

Backend API services for PrayU application.

## Available APIs

### Church Search API

Search for churches from ch114.kr.

```
GET /api/churches/search?name={churchName}
```

Example: `/api/churches/search?name=서울반석`

Returns church information including:

- Church name
- Group/denomination
- Address
- Phone number
- Pastor name
- Detail URL

See the [Church API documentation](supabase/functions/api/churches/README.md) for more details.

## Development

### Setup

```bash
npm install
```

### Running Locally

```bash
npm run supabase-serve
```

This will start the Supabase Edge Functions locally.

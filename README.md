# Authentic Investment System

An Expo-based mobile application starter project that connects to a Supabase backend for authentication and data storage.

## Prerequisites

- [Node.js](https://nodejs.org/) and npm
- [Expo CLI](https://docs.expo.dev/get-started/installation/)

## Installation

```bash
npm install
```

## Environment Variables

1. Copy [.env.example](.env.example) to `.env`.
2. Fill in the required Supabase values:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

   These values can be found in your Supabase project's settings. A Supabase project is required for authentication and database services.

## Running the App

Start the development server:

```bash
npm run dev
```

Or use the default command:

```bash
npm start
```

This will launch the Expo development tools for running the app on a simulator or physical device.

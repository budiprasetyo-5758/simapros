

## Problem

Google OAuth login fails with `"Unsupported provider: missing OAuth secret"` because the code calls `supabase.auth.signInWithOAuth()` directly. Lovable Cloud manages Google OAuth credentials through its own proxy, requiring the `lovable.auth.signInWithOAuth()` method instead.

## Root Cause

The `replit.md` notes this project was migrated from Lovable to Replit, which removed the `@lovable.dev/cloud-auth-js` package and `src/integrations/lovable/` directory. Now that the project is back on Lovable Cloud, those need to be restored.

## Fix Plan

1. **Run the Configure Social Auth tool** to regenerate the `src/integrations/lovable/` module and install `@lovable.dev/cloud-auth-js`.

2. **Update `src/hooks/useAuth.tsx`** — change `signInWithGoogle` to use the Lovable managed OAuth:
   ```typescript
   import { lovable } from "@/integrations/lovable/index";

   const signInWithGoogle = async () => {
     const result = await lovable.auth.signInWithOAuth("google", {
       redirect_uri: window.location.origin,
     });
     if (result.error) return { error: new Error(result.error.message) };
     return { error: null };
   };
   ```

3. **Fix the two build errors** in the same pass:
   - **`FollowUpCategory.tsx` line 719**: the `onMeetingAdded` callback returns a meeting object instead of `void`. Add an explicit `return;` or cast.
   - **`vite.config.ts`**: change `allowedHosts: true` to `allowedHosts: true as const` (or remove it), since the Vite type expects `true | string[] | undefined`, not `boolean`.


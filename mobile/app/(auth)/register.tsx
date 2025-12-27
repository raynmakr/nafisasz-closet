import { Redirect } from 'expo-router';

// With social auth (Google/Apple), registration happens automatically
// when a user signs in for the first time. Redirect to login screen.
export default function RegisterScreen() {
  return <Redirect href="/(auth)/login" />;
}

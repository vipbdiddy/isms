import { Redirect } from 'expo-router';

/** Unknown addresses (e.g. an old link, or the web build hosted under another path) go to Today. */
export default function NotFound() {
  return <Redirect href="/" />;
}

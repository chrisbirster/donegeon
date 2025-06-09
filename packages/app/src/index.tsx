/* @refresh reload */
import { render } from 'solid-js/web'
import App from './App.tsx'
import { AuthProvider } from './AuthContext.tsx';

const wrapper = document.getElementById("root");
if (!wrapper) {
  throw new Error("Wrapper div not found");
}

render(
  () => (
    <AuthProvider>
      <App />
    </AuthProvider>
  ),
  wrapper
);

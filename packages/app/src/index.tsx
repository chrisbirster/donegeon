/* @refresh reload */
import { render } from 'solid-js/web'
import App from './App.tsx'
// import { AuthProvider } from './AuthContext.tsx';
import { AuthProvider } from './components/context-openauth.tsx';

const wrapper = document.getElementById("root");
if (!wrapper) {
  throw new Error("Wrapper div not found");
}

// render(
//   () => (
//     <AuthProvider>
//       <App />
//     </AuthProvider>
//   ),
//   wrapper
// );

render(
  () => (
    <AuthProvider issuer={"https://auth.donegeon.com"} clientID="game">
      <App />
    </AuthProvider>
  ),
  wrapper
);

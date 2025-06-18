import { createMemo, Show } from "solid-js";
import { useAuth } from "./components/context-openauth"
import { css } from "@linaria/core";
import { A } from "@solidjs/router";

const bg = css`
  background-color: #bada55;
`

const DonegeonLanding = () => {
  const auth = useAuth()

  const ready = createMemo(() => true);
  return (
    <Show
      when={ready()}
      fallback={<div>Loading…</div>}
    >
      <div class={bg}>
        {auth.subject ? (
          <>
            <p>
              Logged&nbsp;in as <strong>{auth.subject.id}</strong>
            </p>

            <A href="/game">Game</A>

            {/* arrow wrapper so onClick receives no event arg */}
            <button onClick={() => auth.logout()}>Logout</button>
          </>
        ) : (
          <button onClick={() => auth.authorize()}>
            Login with OAuth
          </button>
        )}
      </div>
    </Show>
  )

}

export default DonegeonLanding;

import { Show } from "solid-js";
import { useAuth } from "./AuthContext"
import { css } from "@linaria/core";
import { A } from "@solidjs/router";

const bg = css`
  background-color: #bada55;
`

const DonegeonLanding = () => {
  const auth = useAuth()
  return (
    <Show
      when={auth.loaded()}
      fallback={<div>Loading…</div>}
    >
      <div class={bg}>
        {auth.loggedIn() ? (
          <div>
            <p>
              <span>Logged in</span>
              {auth.userId() && <span> as {auth.userId()}</span>}
            </p>
            <div>
              <A href="/game">Game</A>
            </div>
            <button onClick={auth.logout}>Logout</button>
          </div>
        ) : (
          <button onClick={auth.login}>Login with OAuth</button>
        )}
      </div>
    </Show>
  )

}

export default DonegeonLanding;

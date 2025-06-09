import { createSignal, Show } from "solid-js";
import { useAuth } from "./AuthContext"
import { css } from "@linaria/core";

const bg = css`
  background-color: #bada55;
`

const DonegeonLanding = () => {
  const auth = useAuth()
  const [status, setStatus] = createSignal("")

  async function callApi() {
    const res = await fetch("https://auth.donegeon.com", {
      headers: {
        Authorization: `Bearer ${await auth.getToken()}`,
      },
    })

    setStatus(res.ok ? "success" : "error")
  }

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
            {status() !== "" && <p>API call: {status()}</p>}
            <button onClick={callApi}>Call API</button>
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

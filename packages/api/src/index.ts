import "dotenv/config"
import { app } from "./app.js"
import { env } from "./config/env.js"

app.listen(env.port, () => {
  console.log(`api listening on :${env.port} [${env.nodeEnv}]`)
})

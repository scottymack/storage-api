import { FastifyInstance } from 'fastify'
import { IncomingMessage, Server, ServerResponse } from 'http'
import pino from 'pino'

import build from './app'
import buildAdmin from './admin-app'
import { getConfig } from './utils/config'
import { runMultitenantMigrations, runMigrations } from './utils/migrate'
import { listenForTenantUpdate } from './utils/tenant'

const logger = pino({
  formatters: {
    level(label) {
      return { level: label }
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})

const exposeDocs = true

;(async () => {
  const { isMultitenant, requestIdHeader, adminRequestIdHeader } = getConfig()
  if (isMultitenant) {
    await runMultitenantMigrations()
    await listenForTenantUpdate()

    const adminApp: FastifyInstance<Server, IncomingMessage, ServerResponse> = buildAdmin({
      logger,
      requestIdHeader: adminRequestIdHeader,
    })

    try {
      await adminApp.listen(5001, '0.0.0.0')
    } catch (err) {
      adminApp.log.error(err)
      process.exit(1)
    }
  } else {
    await runMigrations()
  }

  const app: FastifyInstance<Server, IncomingMessage, ServerResponse> = build({
    logger,
    exposeDocs,
    requestIdHeader,
  })

  app.listen(5000, '0.0.0.0', (err, address) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    console.log(`Server listening at ${address}`)
  })
})()

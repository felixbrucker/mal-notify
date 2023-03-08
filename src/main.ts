import {defaultLogger} from './logging/logger.js'
import {Database} from './database/database.js'
import {databaseUrl} from './config/config.js'
import {ChangeDetection} from './mal/change-detection.js'
import {DiscordNotifier} from './notify/discord-notifier.js'
import {MalApi} from './mal/mal-api.js'

const { default: packageJson } = await import('../package.json', { assert: { type: 'json' } })

process.on('unhandledRejection', (err: Error) => defaultLogger.error(err))
process.on('uncaughtException', (err: Error) => defaultLogger.error(err))

defaultLogger.info(`Mal-Notify ${packageJson.version}`)

const database = Database.make({ databaseUrl })
await database.startup()

const malApi = new MalApi()
const discordNotifier = new DiscordNotifier(malApi)
const changeDetection = new ChangeDetection(malApi, discordNotifier)

await malApi.init()
await discordNotifier.init()
await changeDetection.init()

process.on('SIGINT', async () => {
  defaultLogger.info('Received SIGINT, shutting down ..')
  changeDetection.shutdown()
  discordNotifier.shutdown()
  await database.shutdown()
  process.exit()
})

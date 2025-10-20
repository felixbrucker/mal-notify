import {HydratedDocument} from 'mongoose'
import {
  Client,
  ColorResolvable,
  Colors,
  EmbedBuilder,
  Interaction,
  MessageCreateOptions, REST,
  Routes
} from 'discord.js'
import dayjs from 'dayjs'

import {Anime, AnimeStatus} from '../database/model/anime.js'
import {AnimeNotifier} from '../mal/change-detection.js'
import {discordBotToken, discordTestGuildId, isProduction} from '../config/config.js'
import {makeLogger} from '../logging/logger.js'
import {SlashCommandHandler, SlashCommandHandlerBuilder} from './discord/slash-command-handler.js'
import {SubscribeToUser} from './discord/subscribe-to-user.js'
import {UnsubscribeFromUser} from './discord/unsubscribe-from-user.js'
import {MalApi} from '../mal/mal-api.js'

import '../database/model/discord-user.js'
import relativeTime from 'dayjs/plugin/relativeTime.js'
import isToday from 'dayjs/plugin/isToday.js'
import {ComingSoon} from './discord/coming-soon.js'
import {FinishingSoon} from './discord/finishing-soon.js'
import {makeAnimeMessageOptions} from './discord/anime-formatting.js'

dayjs.extend(relativeTime)
dayjs.extend(isToday)

export class DiscordNotifier implements AnimeNotifier {
  private readonly client: Client = new Client({ intents: [] })
  private readonly restApiClient: REST = new REST({ version: '10' }).setToken(discordBotToken)
  private readonly slashCommandHandler: Map<string, SlashCommandHandler> = new Map<string, SlashCommandHandler>()
  private readonly logger = makeLogger({ name: 'Discord-Notifier' })

  public constructor(malApi: MalApi) {
    this.registerSlashCommandHandlerBuilder(
      UnsubscribeFromUser,
      ComingSoon,
      FinishingSoon,
    )
    this.registerSlashCommandHandler(
      new SubscribeToUser(malApi),
    )
  }

  public async init() {
    const readyPromise = new Promise(resolve => this.client.once('clientReady', resolve))

    this.client.on('error', (err) => { this.logger.error(err) })
    this.client.on('interactionCreate', this.onInteraction.bind(this))

    await this.client.login(discordBotToken)
    await readyPromise

    if (this.client.isReady()) {
      const commandRoute = isProduction
        ? Routes.applicationCommands(this.client.application?.id as string)
        : Routes.applicationGuildCommands(this.client.application?.id as string, discordTestGuildId)
      await this.restApiClient.put(
        commandRoute,
        { body: [...this.slashCommandHandler.values()].map(commandHandler => commandHandler.commandBuilder.toJSON()) }
      )
    }
    this.logger.info('Initialized')
  }

  public shutdown() {
    void this.client.destroy()
  }

  public async animeStatusChanged(anime: HydratedDocument<Anime>) {
    const discordIds = await anime.getSubscribedDiscordUserIds()
    if (discordIds.length === 0) {
      return
    }
    const messageOptions = makeAnimeMessageOptions(anime)
    for (const discordId of discordIds) {
      try {
        const user = await this.client.users.fetch(discordId)
        await user.send(messageOptions)
      } catch (err) {
        let title = anime.title
        if (anime.titleEn !== undefined && anime.title !== anime.titleEn) {
          title += ` (${anime.titleEn})`
        }
        this.logger.error(`Failed to notify discord user ${discordId} for status change of ${title}: ${err.message}`)
      }
    }
  }

  private registerSlashCommandHandlerBuilder(...slashCommandHandlerBuilders: SlashCommandHandlerBuilder[]): void {
    const slashCommandHandlers = slashCommandHandlerBuilders.map(slashCommandHandlerBuilder => slashCommandHandlerBuilder.make(this.client))
    this.registerSlashCommandHandler(...slashCommandHandlers)
  }

  private registerSlashCommandHandler(...slashCommandHandlers: SlashCommandHandler[]): void {
    slashCommandHandlers.forEach(slashCommandHandler => {
      this.slashCommandHandler.set(slashCommandHandler.commandBuilder.name, slashCommandHandler)
    })
  }

  private async onInteraction(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isChatInputCommand()) {
        const command = this.slashCommandHandler.get(interaction.commandName)
        if (!command) {
          await interaction.reply({ content: 'Something went wrong!', ephemeral: true })

          return
        }
        await command.handle(interaction)

        return
      }
    } catch (error) {
      this.logger.error(error)
    }
  }
}

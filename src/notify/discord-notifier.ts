import {HydratedDocument} from 'mongoose'
import {
  APIEmbedField,
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

dayjs.extend(relativeTime)

export class DiscordNotifier implements AnimeNotifier {
  private readonly client: Client = new Client({ intents: [] })
  private readonly restApiClient: REST = new REST({ version: '10' }).setToken(discordBotToken)
  private readonly slashCommandHandler: Map<string, SlashCommandHandler> = new Map<string, SlashCommandHandler>()
  private readonly logger = makeLogger({ name: 'Discord-Notifier' })

  public constructor(malApi: MalApi) {
    this.registerSlashCommandHandlerBuilder(
      UnsubscribeFromUser,
    )
    this.registerSlashCommandHandler(
      new SubscribeToUser(malApi),
    )
  }

  public async init() {
    const readyPromise = new Promise(resolve => this.client.once('ready', resolve))

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
    this.client.destroy()
  }

  public async animeStatusChanged(anime: HydratedDocument<Anime>) {
    const discordIds = await anime.getSubscribedDiscordUserIds()
    if (discordIds.length === 0) {
      return
    }
    const messageOptions = this.makeAnimeStatusChangeMessageOptions(anime)
    for (const discordId of discordIds) {
      const user = await this.client.users.fetch(discordId)
      await user.send(messageOptions)
    }
  }

  private makeAnimeStatusChangeMessageOptions(anime: HydratedDocument<Anime>): MessageCreateOptions {
    const startDate = anime.startDate ? dayjs(anime.startDate) : undefined
    const endDate = anime.endDate ? dayjs(anime.endDate) : undefined
    let formattedState: string
    let color: ColorResolvable
    switch (anime.status) {
      case AnimeStatus.currentlyAiring:
        if (startDate === undefined) {
          formattedState = 'started airing'
        } else if (startDate.isSame(dayjs().startOf('day'))) {
          formattedState = 'started airing today'
        } else if (startDate.isBefore(dayjs().startOf('day'))) {
          formattedState = `started airing ${startDate.fromNow()}`
        } else {
          formattedState = `will start airing ${startDate.toNow()}`
        }
        color = Colors.Aqua
        break
      case AnimeStatus.finishedAiring:
        if (endDate === undefined) {
          formattedState = 'finished airing'
        } else if (endDate.isSame(dayjs().startOf('day'))) {
          formattedState = 'finished airing today'
        } else if (endDate.isBefore(dayjs().startOf('day'))) {
          formattedState = `finished airing ${endDate.fromNow()}`
        } else {
          formattedState = `will finish airing ${endDate.toNow()}`
        }
        color = Colors.Green
        break
      case AnimeStatus.notYetAired:
        formattedState = 'did not air yet'
        color = Colors.Grey
        break
    }
    let title = anime.title
    if (anime.titleEn !== undefined && anime.title !== anime.titleEn) {
      title += `\n${anime.titleEn}`
    }

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(`Anime ${formattedState}`)
          .setColor(color)
          .addFields([{
            name: 'Title',
            value: title,
          }, {
            name: 'Start date',
            value: startDate ? startDate.format('YYYY-MM-DD') : 'N/A',
            inline: true,
          }, {
            name: 'End date',
            value: endDate ? endDate.format('YYYY-MM-DD') : 'N/A',
            inline: true,
          }, {
            name: 'Episodes',
            value: `${anime.numberOfEpisodes}`,
            inline: true,
          }])
          .setURL(`https://myanimelist.net/anime/${anime.malId}`)
          .setThumbnail(anime.imageUrl ?? null)
      ],
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

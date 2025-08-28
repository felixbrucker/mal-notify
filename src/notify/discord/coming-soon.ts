import {ChatInputCommandInteraction} from 'discord.js'
import {SlashCommandBuilder} from '@discordjs/builders'

import {SlashCommandHandler} from './slash-command-handler.js'
import {DiscordUserModel} from '../../database/model/discord-user.js'
import {ObjectId} from 'mongoose'
import {AnimeModel} from '../../database/model/anime.js'
import dayjs from 'dayjs'
import {makeAnimesMessageOptions} from './anime-formatting.js'

export class ComingSoon implements SlashCommandHandler {
  public static make(): ComingSoon {
    return new ComingSoon()
  }

  public readonly commandBuilder: SlashCommandBuilder = new SlashCommandBuilder()

  public constructor() {
    this.commandBuilder
      .setName('coming-soon')
      .setDescription('Show a list of shows which are starting to air soon')
  }

  public async handle(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply()
    const discordUser = await DiscordUserModel
      .findOne({ discordId: interaction.user.id })
      .populate('subscribedToUsers')
    if (discordUser === null) {
      await interaction.editReply(`❌ Not subscribed to any users`)

      return
    }
    const animeDbIds: ObjectId[] = discordUser.subscribedToUsers.flatMap((user: any) => user.planToWatchAnimes)
    const comingSoonAnimes = await AnimeModel
      .find({
        id: animeDbIds,
        startDate: {
          $gt: new Date(),
          $lt: dayjs().add(2, 'weeks').toDate(),
        }
      })
      .sort({ startDate: 1})
    if (comingSoonAnimes.length === 0) {
      await interaction.editReply(`:white_check_mark: No shows coming soon`)

      return
    }

    const messageOptions = makeAnimesMessageOptions(comingSoonAnimes)
    await interaction.editReply(messageOptions[0])
    for (const messageOption of messageOptions.slice(1)) {
      await interaction.followUp(messageOption)
    }
  }
}

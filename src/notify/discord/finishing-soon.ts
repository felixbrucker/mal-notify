import {ChatInputCommandInteraction} from 'discord.js'
import {SlashCommandBuilder} from '@discordjs/builders'

import {SlashCommandHandler} from './slash-command-handler.js'
import {DiscordUserModel} from '../../database/model/discord-user.js'
import {ObjectId} from 'mongoose'
import {AnimeModel} from '../../database/model/anime.js'
import dayjs from 'dayjs'
import {makeAnimesMessageOptions} from './anime-formatting.js'

export class FinishingSoon implements SlashCommandHandler {
  public static make(): FinishingSoon {
    return new FinishingSoon()
  }

  public readonly commandBuilder: SlashCommandBuilder = new SlashCommandBuilder()

  public constructor() {
    this.commandBuilder
      .setName('finishing-soon')
      .setDescription('Show a list of shows which are finishing soon')
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
    const finishingSoonAnimes = await AnimeModel
      .find({
        id: animeDbIds,
        endDate: {
          $gt: new Date(),
          $lt: dayjs().add(2, 'weeks').toDate(),
        }
      })
      .sort({ endDate: 1})
    if (finishingSoonAnimes.length === 0) {
      await interaction.editReply(`:white_check_mark: No shows finishing soon`)

      return
    }

    const messageOptions = makeAnimesMessageOptions(finishingSoonAnimes)
    await interaction.editReply(messageOptions[0])
    for (const messageOption of messageOptions.slice(1)) {
      await interaction.followUp(messageOption)
    }
  }
}

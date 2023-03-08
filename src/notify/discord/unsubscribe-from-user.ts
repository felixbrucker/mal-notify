import {ChatInputCommandInteraction} from 'discord.js'
import {SlashCommandBuilder} from '@discordjs/builders'

import {SlashCommandHandler} from './slash-command-handler.js'
import {DiscordUserModel} from '../../database/model/discord-user.js'
import {MalUserModel} from '../../database/model/mal-user.js'
import {CleanupService} from '../../database/cleanup-service.js'

export class UnsubscribeFromUser implements SlashCommandHandler {
  public static make(): UnsubscribeFromUser {
    return new UnsubscribeFromUser()
  }

  public readonly commandBuilder: SlashCommandBuilder = new SlashCommandBuilder()
  private readonly cleanupService: CleanupService = new CleanupService()

  private constructor() {
    this.commandBuilder
      .setName('unsubscribe-from-user')
      .setDescription('Unsubscribe from plan to watch list for an account')
      .addStringOption(option =>
        option
          .setName('username')
          .setDescription('The username of the user to unsubscribe from')
          .setRequired(true)
      )
  }

  public async handle(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply()
    const username = interaction.options.getString('username', true)
    const discordUser = await DiscordUserModel.findOne({ discordId: interaction.user.id })
    if (discordUser === null) {
      await interaction.editReply(`☑ Already unsubscribed from account`)

      return
    }
    const malUser = await MalUserModel.findOne({ username })
    if (malUser === null) {
      await interaction.editReply(`☑ Already unsubscribed from account`)

      return
    }
    discordUser.unsubscribeFrom(malUser)
    const alreadyUnsubscribed = !discordUser.isModified()
    if (discordUser.subscribedToUsers.length === 0) {
      await DiscordUserModel.deleteOne({ _id: discordUser._id })
    } else {
      await discordUser.save()
    }

    await interaction.editReply(alreadyUnsubscribed ? `☑ Already unsubscribed from account` : `☑ Successfully unsubscribed from account`)

    await this.cleanupService.cleanupMalUserIfUnused(malUser)
  }
}

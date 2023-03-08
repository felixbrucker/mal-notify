import {ChatInputCommandInteraction} from 'discord.js'
import {SlashCommandBuilder} from '@discordjs/builders'

import {SlashCommandHandler} from './slash-command-handler.js'
import {DiscordUserModel} from '../../database/model/discord-user.js'
import {MalUserModel} from '../../database/model/mal-user.js'
import {MalApi} from '../../mal/mal-api.js'

export class SubscribeToUser implements SlashCommandHandler {
  public readonly commandBuilder: SlashCommandBuilder = new SlashCommandBuilder()

  public constructor(private readonly malApi: MalApi) {
    this.commandBuilder
      .setName('subscribe-to-user')
      .setDescription('Subscribe to plan to watch list for an account')
      .addStringOption(option =>
        option
          .setName('username')
          .setDescription('The username of the user to subscribe to')
          .setRequired(true)
      )
  }

  public async handle(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply()
    const username = interaction.options.getString('username', true)
    let discordUser = await DiscordUserModel.findOne({ discordId: interaction.user.id })
    if (discordUser === null) {
      discordUser = new DiscordUserModel({ discordId: interaction.user.id })
    }
    let malUser = await MalUserModel.findOne({ username })
    if (malUser === null) {
      const usernameExists = await this.malApi.exists(username)
      if (!usernameExists) {
        await interaction.editReply(`❌ Account with username "${username}" could not be found`)

        return
      }
      malUser = new MalUserModel({ username })
      await malUser.save()
    }
    discordUser.subscribeTo(malUser)
    const alreadySubscribed = !discordUser.isModified()
    await discordUser.save()

    await interaction.editReply(alreadySubscribed ? '☑ Already subscribed to account' : `☑ Successfully subscribed to account`)
  }
}

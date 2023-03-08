import {SlashCommandBuilder} from '@discordjs/builders'
import {ChatInputCommandInteraction, Client} from 'discord.js'

export interface SlashCommandHandler {
  commandBuilder: SlashCommandBuilder,
  handle(interaction: ChatInputCommandInteraction): Promise<void>
}

export interface SlashCommandHandlerBuilder {
  make(client?: Client): SlashCommandHandler
}

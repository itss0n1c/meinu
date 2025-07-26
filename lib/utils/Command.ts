import {
	type AnySelectMenuInteraction,
	type ApplicationCommandOptionData,
	ApplicationCommandOptionType,
	type ApplicationCommandSubCommandData,
	ApplicationCommandType,
	ApplicationIntegrationType,
	type AutocompleteInteraction,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Interaction,
	InteractionContextType,
	type InteractionResponse,
	type Message,
	type MessageContextMenuCommandInteraction,
	type ModalSubmitInteraction,
	type UserContextMenuCommandInteraction,
} from 'discord.js';
import type { Meinu } from '../index.js';
import { Locales, type LocalesPartial, set_locales } from './locales.js';

export type CommandResponse = void | Promise<InteractionResponse | void | Message>;

export type InteractionHadlerCB<T extends Interaction, Inst = Meinu> = (bot: Inst, int: T) => CommandResponse;

/**
 * Typings for interaction handlers.
 * used in {@link Command.addHandler} method.
 * @internal
 */
export interface CommandInteractionHandlers<Inst = Meinu> {
	chat_input: InteractionHadlerCB<ChatInputCommandInteraction, Inst>;
	button: InteractionHadlerCB<ButtonInteraction, Inst>;
	modal_submit: InteractionHadlerCB<ModalSubmitInteraction, Inst>;
	select_menu: InteractionHadlerCB<AnySelectMenuInteraction, Inst>;
	user_context_menu: InteractionHadlerCB<UserContextMenuCommandInteraction, Inst>;
	message_context_menu: InteractionHadlerCB<MessageContextMenuCommandInteraction, Inst>;
	autocomplete: InteractionHadlerCB<AutocompleteInteraction, Inst>;
}

export type CommandHandler<Inst, T extends keyof CommandInteractionHandlers<Inst>> = Partial<{
	[K in T]: CommandInteractionHandlers<Inst>[K];
}>;

/**
 * The base info for a command.
 * @internal
 */
export interface CommandInfoBasics {
	name: string | Locales;
	/**
	 * @default false
	 */
	owners_only?: boolean;
	/**
	 * @default false
	 */
	nsfw?: boolean;
	integration_types?: Array<ApplicationIntegrationType>;
	contexts?: Array<InteractionContextType>;
}

/**
 * Typings for a command initiated by a message context menu action.
 * @internal
 */
export interface CommandInfoMessage extends CommandInfoBasics {
	type: ApplicationCommandType.Message;
}

/**
 * Typings for a command initiated by a user profile context menu action.
 * @internal
 */
export interface CommandInfoUser extends CommandInfoBasics {
	type: ApplicationCommandType.User;
}

/**
 * Typings for a command initiated by a slash command.
 * @internal
 */
export interface CommandInfoChat extends CommandInfoBasics {
	type?: ApplicationCommandType.ChatInput;
	description: string | Locales;
	options?: ApplicationCommandOptionData[];
}

/**
 * Typings for a command.
 * @internal
 */
export type CommandInfo = CommandInfoChat | CommandInfoMessage | CommandInfoUser;

/**
 * This is used by Meinu internally to export command info to Discord.
 *
 * @internal
 */
export type CommandInfoExport = CommandInfo & {
	name: string;
	nameLocalizations: LocalesPartial;
	description: string;
	descriptionLocalizations: LocalesPartial;
	nsfw: boolean;
	contexts: Array<InteractionContextType> | null;
};

/**
 * Typings for A function that checks if a user has permission to run a command.
 * @internal
 */
export type CommandHasPermission<Inst = Meinu> = (bot: Inst, int: Interaction) => Promise<boolean>;

export interface CommandSubGroup<T = Command> {
	name: string | Locales;
	description: string | Locales;
	commands: T[];
}

/**
 * Command class.
 * @template Inst - Meinu instance
 * It's a builder for slash commands, buttons, etc.
 */
export class Command<Inst = Meinu> {
	name: Locales;
	description: Locales;
	type: CommandInfo['type'];
	integration_types: ApplicationIntegrationType[];
	contexts: InteractionContextType[];
	options: ApplicationCommandOptionData[] = [];
	subcommands: Command<Inst>[] = [];
	#_handlers: CommandHandler<Inst, keyof CommandInteractionHandlers<Inst>> = {};
	checkPermission: CommandHasPermission<Inst>;
	ownersOnly: boolean;
	nsfw: boolean;

	constructor(info: CommandInfo) {
		this.name = info.name instanceof Locales ? info.name : set_locales({ default: info.name });
		this.ownersOnly = info.owners_only ?? false;
		info.type = info.type ?? ApplicationCommandType.ChatInput;
		this.type = info.type;
		if (info.type === ApplicationCommandType.ChatInput) {
			this.description =
				info.description instanceof Locales ? info.description : set_locales({ default: info.description });
			this.options = info.options ?? [];
		} else {
			this.description = set_locales({ default: '' });
		}
		this.integration_types = info.integration_types ?? [];
		this.contexts = info.contexts ?? [];
		this.checkPermission = () => Promise.resolve(true);
		this.nsfw = info.nsfw ?? false;
	}

	#_numSort = (a: number, b: number) => a - b;

	get global(): boolean {
		if (this.integration_types.includes(ApplicationIntegrationType.UserInstall)) return true;
		if (this.contexts.includes(InteractionContextType.BotDM)) return true;
		if (this.contexts.includes(InteractionContextType.PrivateChannel)) return true;
		return false;
	}

	addSubCommandGroup(group: CommandSubGroup<Command<Inst>>): this {
		const opts: Partial<ApplicationCommandOptionData> = {
			type: ApplicationCommandOptionType.SubcommandGroup,
			options: group.commands.map((c) => {
				const opts: Partial<ApplicationCommandSubCommandData> = {
					type: ApplicationCommandOptionType.Subcommand,
				};
				opts.name = c.name.get('default');
				if (c.description instanceof Locales) {
					opts.description = c.description.get('default');
					if (c.description.size > 1) opts.descriptionLocalizations = c.description.toJSON();
				}
				if (c.name.size > 1) opts.nameLocalizations = c.name.toJSON();
				if (c.options.length > 0) opts.options = c.options as ApplicationCommandSubCommandData['options'];
				return opts as ApplicationCommandSubCommandData;
			}),
		};
		if (group.name instanceof Locales) {
			opts.name = group.name.get('default');
			if (group.name.size > 1) opts.nameLocalizations = group.name.toJSON();
		} else opts.name = group.name;

		if (group.description instanceof Locales) {
			opts.description = group.description.get('default');
			if (group.description.size > 1) opts.descriptionLocalizations = group.description.toJSON();
		} else opts.description = group.description;

		this.options.push(opts as ApplicationCommandOptionData);

		for (const cmd of group.commands) {
			cmd.name.set('default', `${group.name} ${cmd.name.get('default')}`);
			this.subcommands.push(cmd);
		}

		return this;
	}

	addSubCommands(cmds: Command<Inst>[]): this {
		this.subcommands.push(...cmds);
		for (const cmd of cmds) {
			const opts: Partial<ApplicationCommandOptionData> = {
				type: ApplicationCommandOptionType.Subcommand,
			};
			if (cmd.options.length > 0) opts.options = cmd.options as ApplicationCommandSubCommandData['options'];
			opts.name = cmd.name.get('default');
			opts.description = cmd.description.get('default');
			if (cmd.name.size > 1) opts.nameLocalizations = cmd.name.toJSON();
			if (cmd.description.size > 1) opts.descriptionLocalizations = cmd.description.toJSON();
			this.options.push(opts as ApplicationCommandOptionData);
		}
		return this;
	}

	commandInfo(): CommandInfoExport {
		const res: Partial<CommandInfoExport> = {
			type: this.type,
		};
		res.name = this.name.get('default');
		res.description = this.description.get('default');
		if (this.description.size > 1) res.descriptionLocalizations = this.description.toJSON();
		if (this.name.size > 1) res.nameLocalizations = this.name.toJSON();
		if (this.description && this.description.size > 1) res.descriptionLocalizations = this.description.toJSON();
		if (res.type === ApplicationCommandType.ChatInput) if (this.options.length > 0) res.options = this.options;
		if (this.nsfw) res.nsfw = true;

		res.integration_types =
			this.integration_types.length > 0 ? this.integration_types.sort(this.#_numSort) : undefined;
		res.contexts = (this.contexts.length > 0 ? this.contexts.sort(this.#_numSort) : null) as typeof res.contexts;
		return res as CommandInfoExport;
	}

	addHandler<T extends keyof CommandInteractionHandlers<Inst>>(
		type: T,
		handler: CommandInteractionHandlers<Inst>[T],
	): this {
		this.#_handlers[type] = handler;
		return this;
	}

	setPermission(cb: CommandHasPermission<Inst>): this {
		this.checkPermission = cb;
		return this;
	}

	async handle<Type extends keyof CommandInteractionHandlers<Inst>>(
		type: Type,
		bot: Inst,
		int: Interaction,
	): Promise<Message | InteractionResponse | void> {
		if (this.#_handlers[type])
			return (this.#_handlers[type] as CommandInteractionHandlers<Inst>[Type])(bot, int as any);
	}
}

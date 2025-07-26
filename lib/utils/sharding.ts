import { ShardingManager } from 'discord.js';
import { config } from 'dotenv';
import { _meinu_log } from './logging';

config({ quiet: true });

export class MeinuSharding {
	#_manager: ShardingManager;
	private constructor(path: string, _token?: string) {
		const token = _token ?? process.env.TOKEN;
		if (token === undefined) throw new Error('Token is not defined');
		this.#_manager = new ShardingManager(path, { token });
	}

	static async init(path: string, token?: string): Promise<MeinuSharding> {
		const inst = new MeinuSharding(path, token);
		inst.#_manager.on('shardCreate', (shard) =>
			_meinu_log({ title: 'shard', bot: null }, `Launched shard ${shard.id}`),
		);
		await inst.#_manager.spawn();
		return inst;
	}
}

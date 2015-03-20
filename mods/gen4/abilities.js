exports.BattleAbilities = {
	"angerpoint": {
		inherit: true,
		desc: "If this Pokemon, or its Substitute, is struck by a Critical Hit, its Attack is boosted to six stages.",
		shortDesc: "If this Pokemon is hit by a critical hit, its Attack is boosted by 12.",
		onAfterSubDamage: function (damage, target, source, move) {
			if (!target.hp) return;
			if (move && move.effectType === 'Move' && move.crit) {
				target.setBoost({atk: 6});
				this.add('-setboost', target, 'atk', 12, '[from] ability: Anger Point');
			}
		}
	},
	"leafguard": {
		onSetStatus: function (status, target, source, effect) {
			if (effect && effect.id === 'rest') {
				return;
			} else if (this.isWeather('sunnyday')) {
				return false;
			}
		}
	},
	"lightningrod": {
		inherit: true,
		desc: "During double battles, this Pokemon draws any single-target Electric-type attack to itself. If an opponent uses an Electric-type attack that affects multiple Pokemon, those targets will be hit. This ability does not affect Electric Hidden Power or Judgment.",
		shortDesc: "This Pokemon draws Electric moves to itself.",
		onTryHit: function () {},
		rating: 0
	},
	"magicguard": {
		//desc: "",
		shortDesc: "This Pokemon can only be damaged by direct attacks.",
		onDamage: function (damage, target, source, effect) {
			if (effect.effectType !== 'Move') {
				return false;
			}
		},
		onSetStatus: function (status, target, source, effect) {
			if (effect && effect.id === 'toxicspikes') {
				return false;
			}
		},
		id: "magicguard",
		name: "Magic Guard",
		rating: 4.5,
		num: 98
	},
	"minus": {
		desc: "This Pokemon's Special Attack receives a 50% boost in double battles if its partner has the Plus ability.",
		shortDesc: "If an ally has the Plus Ability, this Pokemon's Sp. Atk is 1.5x.",
		onModifySpA: function (spa, pokemon) {
			var allyActive = pokemon.side.active;
			if (allyActive.length === 1) {
				return;
			}
			for (var i = 0; i < allyActive.length; i++) {
				if (allyActive[i] && allyActive[i].position !== pokemon.position && !allyActive[i].fainted && allyActive[i].ability === 'plus') {
					return spa * 1.5;
				}
			}
		},
		id: "minus",
		name: "Minus",
		rating: 0,
		num: 58
	},
	"normalize": {
		inherit: true,
		onModifyMovePriority: -1,
		onModifyMove: function (move) {
			if (move.id !== 'struggle') {
				move.type = 'Normal';
			}
		}
	},
	"pickup": {
		desc: "No in-battle effect.",
		shortDesc: "No in-battle effect.",
		id: "pickup",
		name: "Pickup",
		rating: 0,
		num: 53
	},
	"plus": {
		desc: "This Pokemon's Special Attack receives a 50% boost in double battles if its partner has the Minus ability.",
		shortDesc: "If an ally has the Minus Ability, this Pokemon's Sp. Atk is 1.5x.",
		onModifySpA: function (spa, pokemon) {
			var allyActive = pokemon.side.active;
			if (allyActive.length === 1) {
				return;
			}
			for (var i = 0; i < allyActive.length; i++) {
				if (allyActive[i] && allyActive[i].position !== pokemon.position && !allyActive[i].fainted && allyActive[i].ability === 'minus') {
					return spa * 1.5;
				}
			}
		},
		id: "plus",
		name: "Plus",
		rating: 0,
		num: 57
	},
	"simple": {
		shortDesc: "If this Pokemon's stat stages are raised or lowered, the effect is doubled instead.",
		onModifyBoost: function () {
			return this.chainModify(2);
		},
		id: "simple",
		name: "Simple",
		rating: 4,
		num: 86
	},
	"stench": {
		desc: "No in-battle effect.",
		shortDesc: "No in-battle effect.",
		id: "stench",
		name: "Stench",
		rating: 0,
		num: 1
	},
	"stormdrain": {
		inherit: true,
		desc: "During double battles, this Pokemon draws any single-target Water-type attack to itself. If an opponent uses an Water-type attack that affects multiple Pokemon, those targets will be hit. This ability does not affect Water Hidden Power, Judgment or Weather Ball.",
		shortDesc: "This Pokemon draws Water moves to itself.",
		onTryHit: function () {},
		rating: 0
	},
	"sturdy": {
		desc: "This Pokemon is immune to OHKO moves.",
		shortDesc: "OHKO moves fail on this Pokemon.",
		onDamagePriority: -100,
		onDamage: function (damage, target, source, effect) {
			if (effect && effect.ohko) {
				this.add('-activate', target, 'Sturdy');
				return 0;
			}
		},
		id: "sturdy",
		name: "Sturdy",
		rating: 0.5,
		num: 5
	},
	"synchronize": {
		inherit: true,
		onAfterSetStatus: function (status, target, source) {
			if (!source || source === target) return;
			var id = status.id;
			if (id === 'slp' || id === 'frz') return;
			if (id === 'tox') id = 'psn';
			source.trySetStatus(id);
		}
	},
	"trace": {
		inherit: true,
		onUpdate: function (pokemon) {
			var target = pokemon.side.foe.randomActive();
			if (!target || target.fainted) return;
			var ability = this.getAbility(target.ability);
			var bannedAbilities = {forecast:1, multitype:1, trace:1};
			if (bannedAbilities[target.ability]) {
				return;
			}
			if (pokemon.setAbility(ability)) {
				this.add('-ability', pokemon, ability, '[from] ability: Trace', '[of] ' + target);
			}
		}
	},
	"wonderguard": {
		inherit: true,
		onTryHit: function (target, source, move) {
			if (target === source || move.category === 'Status' || move.type === '???' || move.id === 'struggle' || move.id === 'firefang') return;
			this.debug('Wonder Guard immunity: ' + move.id);
			if (target.runEffectiveness(move) <= 0) {
				this.add('-activate', target, 'ability: Wonder Guard');
				return null;
			}
		}
	}
};

/**
 * Gen 3 moves
 */
exports.BattleMovedex = {
	absorb: {
		inherit: true,
		pp: 20
	},
	acid: {
		inherit: true,
		secondary: {
			chance: 10,
			boosts: {
				def: -1
			}
		}
	},
	ancientpower: {
		inherit: true,
		isContact: true
	},
	assist: {
		inherit: true,
		desc: "The user performs a random move from any of the Pokemon on its team. Assist cannot generate itself, Chatter, Copycat, Counter, Covet, Destiny Bond, Detect, Endure, Feint, Focus Punch, Follow Me, Helping Hand, Me First, Metronome, Mimic, Mirror Coat, Mirror Move, Protect, Sketch, Sleep Talk, Snatch, Struggle, Switcheroo, Thief or Trick.",
		onHit: function (target) {
			var moves = [];
			for (var j = 0; j < target.side.pokemon.length; j++) {
				var pokemon = target.side.pokemon[j];
				if (pokemon === target) continue;
				for (var i = 0; i < pokemon.moves.length; i++) {
					var move = pokemon.moves[i];
					var noAssist = {
						assist:1, chatter:1, copycat:1, counter:1, covet:1, destinybond:1, detect:1, endure:1, feint:1, focuspunch:1, followme:1, helpinghand:1, mefirst:1, metronome:1, mimic:1, mirrorcoat:1, mirrormove:1, protect:1, sketch:1, sleeptalk:1, snatch:1, struggle:1, switcheroo:1, thief:1, trick:1
					};
					if (move && !noAssist[move]) {
						moves.push(move);
					}
				}
			}
			var move = '';
			if (moves.length) move = moves[this.random(moves.length)];
			if (!move) {
				return false;
			}
			this.useMove(move, target);
		}
	},
	astonish: {
		inherit: true,
		basePowerCallback: function (pokemon, target) {
			if (target.volatiles['minimize']) return 60;
			return 30;
		}
	},
	beatup: {
		inherit: true,
		basePower: 10,
		basePowerCallback: undefined
	},
	bide: {
		inherit: true,
		accuracy: 100,
		priority: 0
	},
	bind: {
		inherit: true,
		accuracy: 75
	},
	blizzard: {
		inherit: true,
		onModifyMove: function () { }
	},
	bonerush: {
		inherit: true,
		accuracy: 80
	},
	brickbreak: {
		inherit: true,
		onTryHit: function (pokemon) {
			pokemon.side.removeSideCondition('reflect');
			pokemon.side.removeSideCondition('lightscreen');
		}
	},
	bulletseed: {
		inherit: true,
		basePower: 10
	},
	charge: {
		inherit: true,
		boosts: false
	},
	clamp: {
		inherit: true,
		accuracy: 75,
		pp: 10
	},
	cottonspore: {
		inherit: true,
		accuracy: 85
	},
	counter: {
		inherit: true,
		damageCallback: function (pokemon) {
			if (pokemon.lastAttackedBy && pokemon.lastAttackedBy.thisTurn && (this.getCategory(pokemon.lastAttackedBy.move) === 'Physical' || this.getMove(pokemon.lastAttackedBy.move).id === 'hiddenpower')) {
				return 2 * pokemon.lastAttackedBy.damage;
			}
			return false;
		}
	},
	covet: {
		inherit: true,
		basePower: 40,
		isContact: false
	},
	crabhammer: {
		inherit: true,
		accuracy: 85
	},
	crunch: {
		inherit: true,
		secondary: {
			chance: 20,
			boosts: {
				spd: -1
			}
		}
	},
	curse: {
		inherit: true,
		type: "???"
	},
	detect: {
		inherit: true,
		//desc: "",
		priority: 3
	},
	dig: {
		inherit: true,
		basePower: 60
	},
	disable: {
		inherit: true,
		accuracy: 55,
		isBounceable: false,
		volatileStatus: 'disable',
		effect: {
			durationCallback: function () {
				return this.random(2, 6);
			},
			noCopy: true,
			onStart: function (pokemon) {
				if (!this.willMove(pokemon)) {
					this.effectData.duration++;
				}
				if (!pokemon.lastMove) {
					return false;
				}
				var moves = pokemon.moveset;
				for (var i = 0; i < moves.length; i++) {
					if (moves[i].id === pokemon.lastMove) {
						if (!moves[i].pp) {
							return false;
						} else {
							this.add('-start', pokemon, 'Disable', moves[i].move);
							this.effectData.move = pokemon.lastMove;
							return;
						}
					}
				}
				return false;
			},
			onEnd: function (pokemon) {
				this.add('-end', pokemon, 'move: Disable');
			},
			onBeforeMove: function (attacker, defender, move) {
				if (move.id === this.effectData.move) {
					this.add('cant', attacker, 'Disable', move);
					return false;
				}
			},
			onModifyPokemon: function (pokemon) {
				var moves = pokemon.moveset;
				for (var i = 0; i < moves.length; i++) {
					if (moves[i].id === this.effectData.move) {
						pokemon.disableMove(moves[i].id);
					}
				}
			}
		}
	},
	dive: {
		inherit: true,
		basePower: 60
	},
	doomdesire: {
		inherit: true,
		accuracy: 85,
		basePower: 120
	},
	dreameater: {
		inherit: true,
		desc: "Deals damage to one adjacent target, if it is asleep and does not have a Substitute. The user recovers half of the HP lost by the target, rounded up. If Big Root is held by the user, the HP recovered is 1.3x normal, rounded half down.",
		onTryHit: function (target) {
			if (target.status !== 'slp' || target.volatiles['substitute']) {
				this.add('-immune', target, '[msg]');
				return null;
			}
		}
	},
	encore: {
		inherit: true,
		isBounceable: false,
		volatileStatus: 'encore',
		effect: {
			durationCallback: function () {
				return this.random(3, 7);
			},
			onStart: function (target) {
				var noEncore = {encore:1, mimic:1, mirrormove:1, sketch:1, transform:1};
				var moveIndex = target.moves.indexOf(target.lastMove);
				if (!target.lastMove || noEncore[target.lastMove] || (target.moveset[moveIndex] && target.moveset[moveIndex].pp <= 0)) {
					// it failed
					this.add('-fail', target);
					delete target.volatiles['encore'];
					return;
				}
				this.effectData.move = target.lastMove;
				this.add('-start', target, 'Encore');
				if (!this.willMove(target)) {
					this.effectData.duration++;
				}
			},
			onOverrideDecision: function (pokemon) {
				return this.effectData.move;
			},
			onResidualOrder: 13,
			onResidual: function (target) {
				if (target.moves.indexOf(target.lastMove) >= 0 && target.moveset[target.moves.indexOf(target.lastMove)].pp <= 0) {
					// early termination if you run out of PP
					delete target.volatiles.encore;
					this.add('-end', target, 'Encore');
				}
			},
			onEnd: function (target) {
				this.add('-end', target, 'Encore');
			},
			onModifyPokemon: function (pokemon) {
				if (!this.effectData.move || !pokemon.hasMove(this.effectData.move)) {
					return;
				}
				for (var i = 0; i < pokemon.moveset.length; i++) {
					if (pokemon.moveset[i].id !== this.effectData.move) {
						pokemon.disableMove(pokemon.moveset[i].id);
					}
				}
			}
		}
	},
	explosion: {
		inherit: true,
		basePower: 500
	},
	extrasensory: {
		inherit: true,
		basePowerCallback: function (pokemon, target) {
			if (target.volatiles['minimize']) return 160;
			return 80;
		}
	},
	extremespeed: {
		inherit: true,
		priority: 1
	},
	feintattack: {
		inherit: true,
		isContact: false
	},
	fakeout: {
		inherit: true,
		priority: 1,
		isContact: false
	},
	firespin: {
		inherit: true,
		accuracy: 70,
		basePower: 15
	},
	flail: {
		inherit: true,
		accuracy: 100,
		basePower: 0,
		basePowerCallback: function (pokemon, target) {
			var hpPercent = pokemon.hp * 100 / pokemon.maxhp;
			if (hpPercent <= 5) {
				return 200;
			}
			if (hpPercent <= 10) {
				return 150;
			}
			if (hpPercent <= 20) {
				return 100;
			}
			if (hpPercent <= 35) {
				return 80;
			}
			if (hpPercent <= 70) {
				return 40;
			}
			return 20;
		},
		isViable: true,
		pp: 15,
		priority: 0,
		isContact: true,
		secondary: false,
		target: "normal",
		type: "Normal"
	},
	flash: {
		inherit: true,
		accuracy: 70
	},
	fly: {
		inherit: true,
		basePower: 70
	},
	focuspunch: {
		inherit: true,
		beforeMoveCallback: function () { },
		onTry: function (pokemon) {
			if (!pokemon.removeVolatile('focuspunch')) {
				return;
			}
			if (pokemon.lastAttackedBy && pokemon.lastAttackedBy.damage && pokemon.lastAttackedBy.thisTurn) {
				this.attrLastMove('[still]');
				this.add('cant', pokemon, 'Focus Punch', 'Focus Punch');
				return false;
			}
		}
	},
	foresight: {
		inherit: true,
		isBounceable: false
	},
	furycutter: {
		inherit: true,
		basePower: 10
	},
	futuresight: {
		inherit: true,
		accuracy: 90,
		basePower: 80,
		pp: 15
	},
	gigadrain: {
		inherit: true,
		basePower: 60,
		pp: 5
	},
	glare: {
		inherit: true,
		accuracy: 75,
		affectedByImmunities: true
	},
	growth: {
		inherit: true,
		onModifyMove: function () { },
		boosts: {
			spa: 1
		}
	},
	hiddenpower: {
		num: 237,
		accuracy: 100,
		basePower: 0,
		basePowerCallback: function (pokemon) {
			return pokemon.hpPower || 70;
		},
		category: "Physical",
		id: "hiddenpower",
		isViable: true,
		name: "Hidden Power",
		pp: 15,
		priority: 0,
		onModifyMove: function (move, pokemon) {
			move.type = pokemon.hpType || 'Dark';
			var specialTypes = {Fire:1, Water:1, Grass:1, Ice:1, Electric:1, Dark:1, Psychic:1, Dragon:1};
			move.category = specialTypes[move.type] ? 'Special' : 'Physical';
		},
		secondary: false,
		target: "normal",
		type: "Normal"
	},
	highjumpkick: {
		inherit: true,
		basePower: 85,
		pp: 20,
		onMoveFail: function (target, source, move) {
			if (target.runImmunity('Fighting')) {
				var damage = this.getDamage(source, target, move, true);
				this.damage(this.clampIntRange(damage / 2, 1, Math.floor(target.maxhp / 2)), source, source, 'highjumpkick');
			}
		}
	},
	hypnosis: {
		inherit: true,
		accuracy: 60
	},
	iciclespear: {
		inherit: true,
		basePower: 10
	},
	jumpkick: {
		inherit: true,
		basePower: 70,
		pp: 25,
		onMoveFail: function (target, source, move) {
			if (target.runImmunity('Fighting')) {
				var damage = this.getDamage(source, target, move, true);
				this.damage(this.clampIntRange(damage / 2, 1, Math.floor(target.maxhp / 2)), source, source, 'jumpkick');
			}
		}
	},
	leafblade: {
		inherit: true,
		basePower: 70
	},
	megadrain: {
		inherit: true,
		pp: 10
	},
	metronome: {
		inherit: true,
		onHit: function (target) {
			var moves = [];
			for (var i in exports.BattleMovedex) {
				var move = exports.BattleMovedex[i];
				if (i !== move.id) continue;
				if (move.isNonstandard) continue;
				var noMetronome = {
					assist:1, counter:1, covet:1, destinybond:1, detect:1, endure:1, focuspunch:1, followme:1, helpinghand:1, metronome:1, mimic:1, mirrorcoat:1, mirrormove:1, protect:1, sketch:1, sleeptalk:1, snatch:1, struggle:1, thief:1, trick:1
				};
				if (!noMetronome[move.id] && move.num < 355) {
					moves.push(move.id);
				}
			}
			var move = '';
			if (moves.length) move = moves[this.random(moves.length)];
			if (!move) return false;
			this.useMove(move, target);
		}
	},
	minimize: {
		inherit: true,
		boosts: {
			evasion: 1
		}
	},
	mirrormove: {
		inherit: true,
		accuracy: true,
		basePower: 0,
		category: "Status",
		pp: 20,
		priority: 0,
		isNotProtectable: true,
		onTryHit: function (target) {
			var noMirrorMove = {acupressure:1, afteryou:1, aromatherapy:1, chatter:1, conversion2:1, curse:1, doomdesire:1, feint:1, finalgambit:1, focuspunch:1, futuresight:1, gravity:1, guardsplit:1, hail:1, haze:1, healbell:1, healpulse:1, helpinghand:1, lightscreen:1, luckychant:1, mefirst:1, mimic:1, mirrorcoat:1, mirrormove:1, mist:1, mudsport:1, naturepower:1, perishsong:1, powersplit:1, psychup:1, quickguard:1, raindance:1, reflect:1, reflecttype:1, roleplay:1, safeguard:1, sandstorm:1, sketch:1, spikes:1, spitup:1, stealthrock:1, sunnyday:1, tailwind:1, taunt:1, teeterdance:1, toxicspikes:1, transform:1, watersport:1, wideguard:1};
			if (!target.lastMove || noMirrorMove[target.lastMove] || this.getMove(target.lastMove).target === 'self') {
				return false;
			}
		},
		onHit: function (target, source) {
			this.useMove(this.lastMove, source);
		},
		secondary: false,
		target: "normal",
		type: "Flying"
	},
	moonlight: {
		inherit: true,
		onHit: function (pokemon) {
			if (this.isWeather(['sunnyday', 'desolateland'])) {
				this.heal(pokemon.maxhp * 2 / 3);
			} else if (this.isWeather(['raindance', 'primordialsea', 'sandstorm', 'hail'])) {
				this.heal(pokemon.maxhp / 4);
			} else {
				this.heal(pokemon.maxhp / 2);
			}
		}
	},
	morningsun: {
		inherit: true,
		onHit: function (pokemon) {
			if (this.isWeather(['sunnyday', 'desolateland'])) {
				this.heal(pokemon.maxhp * 2 / 3);
			} else if (this.isWeather(['raindance', 'primordialsea', 'sandstorm', 'hail'])) {
				this.heal(pokemon.maxhp / 4);
			} else {
				this.heal(pokemon.maxhp / 2);
			}
		}
	},
	naturepower: {
		inherit: true,
		accuracy: true,
		onHit: function (target) {
			this.useMove('swift', target);
		}
	},
	needlearm: {
		inherit: true,
		basePowerCallback: function (pokemon, target) {
			if (target.volatiles['minimize']) return 120;
			return 60;
		}
	},
	odorsleuth: {
		inherit: true,
		isBounceable: false
	},
	outrage: {
		inherit: true,
		basePower: 90,
		pp: 15
	},
	overheat: {
		inherit: true,
		isContact: true
	},
	petaldance: {
		inherit: true,
		basePower: 70,
		pp: 20
	},
	poisongas: {
		inherit: true,
		accuracy: 55,
		target: "normal"
	},
	protect: {
		inherit: true,
		priority: 3
	},
	recover: {
		inherit: true,
		pp: 20
	},
	roar: {
		inherit: true,
		isBounceable: false
	},
	rockblast: {
		inherit: true,
		accuracy: 80
	},
	rocksmash: {
		inherit: true,
		basePower: 20
	},
	sandtomb: {
		inherit: true,
		accuracy: 70,
		basePower: 15
	},
	scaryface: {
		inherit: true,
		accuracy: 90
	},
	selfdestruct: {
		inherit: true,
		basePower: 400
	},
	skillswap: {
		inherit: true,
		onHit: function (target, source) {
			var targetAbility = this.getAbility(target.ability);
			var sourceAbility = this.getAbility(source.ability);
			if (targetAbility.id === sourceAbility.id) {
				return false;
			}
			this.add('-activate', source, 'move: Skill Swap');
			source.setAbility(targetAbility);
			target.setAbility(sourceAbility);
		}
	},
	spikes: {
		inherit: true,
		isBounceable: false
	},
	spite: {
		inherit: true,
		isBounceable: false,
		onHit: function (target) {
			var roll = this.random(2, 6);
			if (target.deductPP(target.lastMove, roll)) {
				this.add("-activate", target, 'move: Spite', target.lastMove, roll);
				return;
			}
			return false;
		}
	},
	stockpile: {
		inherit: true,
		pp: 10,
		boosts: false
	},
	struggle: {
		inherit: true,
		accuracy: true,
		basePower: 50,
		pp: 1,
		noPPBoosts: true,
		priority: 0,
		isContact: true,
		beforeMoveCallback: function (pokemon) {
			this.add('-activate', pokemon.name, 'move: Struggle');
		},
		onModifyMove: function (move) {
			move.type = '???';
		},
		recoil: [1, 2],
		secondary: false,
		target: "normal",
		type: "Normal"
	},
	synthesis: {
		inherit: true,
		onHit: function (pokemon) {
			if (this.isWeather(['sunnyday', 'desolateland'])) {
				this.heal(pokemon.maxhp * 2 / 3);
			} else if (this.isWeather(['raindance', 'primordialsea', 'sandstorm', 'hail'])) {
				this.heal(pokemon.maxhp / 4);
			} else {
				this.heal(pokemon.maxhp / 2);
			}
		}
	},
	tackle: {
		inherit: true,
		accuracy: 95,
		basePower: 35
	},
	tailglow: {
		inherit: true,
		boosts: {
			spa: 2
		}
	},
	taunt: {
		inherit: true,
		isBounceable: false,
		effect: {
			duration: 2,
			onStart: function (target) {
				this.add('-start', target, 'move: Taunt');
			},
			onResidualOrder: 12,
			onEnd: function (target) {
				this.add('-end', target, 'move: Taunt');
			},
			onModifyPokemon: function (pokemon) {
				var moves = pokemon.moveset;
				for (var i = 0; i < moves.length; i++) {
					if (this.getMove(moves[i].move).category === 'Status') {
						pokemon.disableMove(moves[i].id);
					}
				}
			},
			onBeforeMove: function (attacker, defender, move) {
				if (move.category === 'Status') {
					this.add('cant', attacker, 'move: Taunt', move);
					return false;
				}
			}
		}
	},
	thrash: {
		inherit: true,
		basePower: 90,
		pp: 20
	},
	tickle: {
		inherit: true,
		notSubBlocked: true
	},
	torment: {
		inherit: true,
		isBounceable: false
	},
	toxic: {
		inherit: true,
		accuracy: 85
	},
	uproar: {
		inherit: true,
		basePower: 50
	},
	vinewhip: {
		inherit: true,
		pp: 10
	},
	volttackle: {
		inherit: true,
		recoil: [1, 3],
		secondary: false
	},
	waterfall: {
		inherit: true,
		secondary: false
	},
	whirlpool: {
		inherit: true,
		accuracy: 70,
		basePower: 15
	},
	whirlwind: {
		inherit: true,
		isBounceable: false
	},
	wish: {
		inherit: true,
		effect: {
			duration: 2,
			onResidualOrder: 0,
			onEnd: function (side) {
				var target = side.active[this.effectData.sourcePosition];
				if (!target.fainted) {
					var source = this.effectData.source;
					var damage = this.heal(target.maxhp / 2, target, target);
					if (damage) this.add('-heal', target, target.getHealth, '[from] move: Wish', '[wisher] ' + source.name);
				}
			}
		}
	},
	wrap: {
		inherit: true,
		accuracy: 85
	},
	zapcannon: {
		inherit: true,
		basePower: 100
	},
	magikarpsrevenge: null
};

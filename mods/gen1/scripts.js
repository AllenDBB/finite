/**
 * Gen 1 mechanics are fairly different to those we know on current gen.
 * Therefor we need to make a lot of changes to the battle engine for this game simulation.
 * This generation inherits all the changes from older generations, that must be taken into account when editing code.
 */
exports.BattleScripts = {
	inherit: 'gen2',
	gen: 1,
	debug: function (activity) {
		if (this.getFormat().debug) {
			this.add('debug', activity);
		}
	},
	// Gen 1 stores the last damage dealt by a move in the battle.
	// This is used for the move Counter.
	lastDamage: 0,
	// BattleSide scripts.
	// In gen 1, last move information is stored on the side rather than on the active Pokémon.
	// This is because there was actually no side, just Battle and active Pokémon effects.
	// Side's lastMove is used for Counter and Mirror Move.
	side: {
		lastMove: ''
	},
	// BattlePokemon scripts.
	pokemon: {
		getStat: function (statName, unboosted, unmodified, noscreens) {
			statName = toId(statName);
			if (statName === 'hp') return this.maxhp;

			// base stat
			var stat = this.stats[statName];

			// stat boosts
			if (!unboosted) {
				var boost = this.boosts[statName];
				if (boost > 6) boost = 6;
				if (boost < -6) boost = -6;
				if (boost >= 0) {
					var boostTable = [1, 1.5, 2, 2.5, 3, 3.5, 4];
					stat = Math.floor(stat * boostTable[boost]);
				} else {
					var numerators = [100, 66, 50, 40, 33, 28, 25];
					stat = Math.floor(stat * numerators[-boost] / 100);
				}
			}

			// Stat modifiers: burn, paralyse.
			if (!unmodified) {
				// Burn attack drop is checked when you get the attack stat upon switch in and used until switch out.
				if (this.volatiles['brnattackdrop'] && statName === 'atk') {
					stat = this.battle.clampIntRange(Math.floor(stat / 2), 1);
				}
				if (this.volatiles['parspeeddrop'] && statName === 'spe') {
					stat = this.battle.clampIntRange(Math.floor(stat / 4), 1);
				}
			}

			// Hard coded Reflect and Light Screen boosts
			if (this.volatiles['reflect'] && statName === 'def' && !unboosted && !noscreens) {
				this.battle.debug('Reflect doubles Defense');
				stat *= 2;
				stat = this.battle.clampIntRange(stat, 1, 1998);
			} else if (this.volatiles['lightscreen'] && statName === 'spd' && !unboosted && !noscreens) {
				this.battle.debug('Light Screen doubles Special Defense');
				stat *= 2;
				stat = this.battle.clampIntRange(stat, 1, 1998);
			} else {
				// Gen 1 normally caps stats at 999 and min is 1.
				stat = this.battle.clampIntRange(stat, 1, 999);
			}

			return stat;
		}
	},
	// Battle scripts.
	// runMove can be found in scripts.js. This function is the main one when running a move.
	// It deals with the beforeMove and AfterMoveSelf events.
	// This leads with partial trapping moves shennanigans after the move has been used.
	// It also deals with how PP reduction works on gen 1.
	runMove: function (move, pokemon, target, sourceEffect) {
		move = this.getMove(move);
		if (!target) target = this.resolveTarget(pokemon, move);
		if (target.subFainted) delete target.subFainted;

		this.setActiveMove(move, pokemon, target);

		if (pokemon.movedThisTurn || !this.runEvent('BeforeMove', pokemon, target, move)) {
			// Prevent invulnerability from persisting until the turn ends.
			pokemon.removeVolatile('twoturnmove');
			this.clearActiveMove(true);
			// This is only run for sleep.
			this.runEvent('AfterMoveSelf', pokemon, target, move);
			return;
		}
		if (move.beforeMoveCallback) {
			if (move.beforeMoveCallback.call(this, pokemon, target, move)) {
				this.clearActiveMove(true);
				return;
			}
		}
		pokemon.lastDamage = 0;
		var lockedMove = this.runEvent('LockMove', pokemon);
		if (lockedMove === true) lockedMove = false;
		if (!lockedMove && (!pokemon.volatiles['partialtrappinglock'] || pokemon.volatiles['partialtrappinglock'].locked !== target)) {
			pokemon.deductPP(move, null, target);
			// On gen 1 moves are stored when they are chosen and a PP is deducted.
			pokemon.side.lastMove = move;
			pokemon.lastMove = move;
		}
		this.useMove(move, pokemon, target, sourceEffect);
		this.runEvent('AfterMove', target, pokemon, move);

		// If rival fainted
		if (target.hp <= 0) {
			// We remove recharge
			if (pokemon.volatiles['mustrecharge']) pokemon.removeVolatile('mustrecharge');
			delete pokemon.volatiles['partialtrappinglock'];
			// We remove screens
			target.side.removeSideCondition('reflect');
			target.side.removeSideCondition('lightscreen');
			pokemon.removeVolatile('twoturnmove');
		} else {
			this.runEvent('AfterMoveSelf', pokemon, target, move);
		}

		// For partial trapping moves, we are saving the target
		if (move.volatileStatus === 'partiallytrapped' && target && target.hp > 0) {
			// Let's check if the lock exists
			if (pokemon.volatiles['partialtrappinglock'] && target.volatiles['partiallytrapped']) {
				// Here the partialtrappinglock volatile has been already applied
				if (!pokemon.volatiles['partialtrappinglock'].locked) {
					// If it's the first hit, we save the target
					pokemon.volatiles['partialtrappinglock'].locked = target;
				} else {
					if (pokemon.volatiles['partialtrappinglock'].locked !== target && target !== pokemon) {
						// The target switched, therefor, we must re-roll the duration, damage, and accuracy.
						var duration = [2, 2, 2, 3, 3, 3, 4, 5][this.random(8)];
						pokemon.volatiles['partialtrappinglock'].duration = duration;
						pokemon.volatiles['partialtrappinglock'].locked = target;
						// Duration reset thus partially trapped at 2 always.
						target.volatiles['partiallytrapped'].duration = 2;
						// We deduct an additional PP that was not deducted earlier.
						// Also get the move position for the PP change.
						var usedMovePos = -1;
						for (var m in pokemon.moveset) {
							if (pokemon.moveset[m].id === move.id) usedMovePos = m;
						}
						if (usedMovePos > -1 && pokemon.moveset[usedMovePos].pp === 0) {
							// If we were on the middle of the 0 PP sequence, the PPs get reset to 63.
							pokemon.moveset[usedMovePos].pp = 63;
						} else {
							// Otherwise, plain reduct.
							pokemon.deductPP(move, null, target);
						}
					}
				}
			} // If we move to here, the move failed and there's no partial trapping lock.
		}
	},
	// useMove can be found on scripts.js
	// It is the function that actually uses the move, running ModifyMove events.
	// It uses the move and then deals with the effects after the move.
	useMove: function (move, pokemon, target, sourceEffect) {
		if (!sourceEffect && this.effect.id) sourceEffect = this.effect;
		move = this.getMove(move);
		var baseMove = move;
		move = this.getMoveCopy(move);
		if (!target) target = this.resolveTarget(pokemon, move);
		if (move.target === 'self') {
			target = pokemon;
		}
		if (sourceEffect) move.sourceEffect = sourceEffect.id;

		this.setActiveMove(move, pokemon, target);

		this.singleEvent('ModifyMove', move, null, pokemon, target, move, move);
		if (baseMove.target !== move.target) {
			// Target changed in ModifyMove, so we must adjust it here
			target = this.resolveTarget(pokemon, move);
		}
		move = this.runEvent('ModifyMove', pokemon, target, move, move);
		if (baseMove.target !== move.target) {
			// Check again, this shouldn't ever happen on Gen 1.
			target = this.resolveTarget(pokemon, move);
		}
		if (!move) return false;

		var attrs = '';
		var missed = false;
		if (pokemon.fainted) {
			// Removing screens upon faint.
			pokemon.side.removeSideCondition('reflect');
			pokemon.side.removeSideCondition('lightscreen');
			return false;
		}

		if (move.isTwoTurnMove && !pokemon.volatiles[move.id]) {
			attrs = '|[still]'; // Suppress the default move animation
		}

		if (sourceEffect) attrs += '|[from]' + this.getEffect(sourceEffect);
		this.addMove('move', pokemon, move.name, target + attrs);

		if (!this.singleEvent('Try', move, null, pokemon, target, move)) {
			return true;
		}
		if (!this.runEvent('TryMove', pokemon, target, move)) {
			return true;
		}

		if (typeof move.affectedByImmunities === 'undefined') {
			move.affectedByImmunities = (move.category !== 'Status');
		}

		var damage = false;
		if (target.fainted) {
			this.attrLastMove('[notarget]');
			this.add('-notarget');
			return true;
		}
		damage = this.tryMoveHit(target, pokemon, move);

		// Store 0 damage for last damage if move failed or dealt 0 damage.
		// This only happens on moves that don't deal damage but call GetDamageVarsForPlayerAttack (disassembly).
		if (!damage && (move.category !== 'Status' || (move.category === 'Status' && !(move.status in {'psn':1, 'tox':1, 'par':1}))) &&
		!(move.id in {'conversion':1, 'haze':1, 'mist':1, 'focusenergy':1, 'confuseray':1, 'transform':1, 'lightscreen':1, 'reflect':1, 'substitute':1, 'mimic':1, 'leechseed':1, 'splash':1, 'softboiled':1, 'recover':1, 'rest':1})) {
			pokemon.battle.lastDamage = 0;
		}

		// Go ahead with results of the used move.
		if (!damage && damage !== 0) {
			this.singleEvent('MoveFail', move, null, target, pokemon, move);
			return true;
		}

		if (!move.negateSecondary) {
			this.singleEvent('AfterMoveSecondarySelf', move, null, pokemon, target, move);
			this.runEvent('AfterMoveSecondarySelf', pokemon, target, move);
		}
		return true;
	},
	// tryMoveHit can be found on scripts.js
	// This function attempts a move hit and returns the attempt result before the actual hit happens.
	// It deals with partial trapping weirdness and accuracy bugs as well.
	tryMoveHit: function (target, pokemon, move, spreadHit) {
		var boostTable = [1, 4 / 3, 5 / 3, 2, 7 / 3, 8 / 3, 3];
		var doSelfDestruct = true;
		var damage = 0;

		// First, let's calculate the accuracy.
		var accuracy = move.accuracy;

		// Partial trapping moves: true accuracy while it lasts
		if (move.volatileStatus === 'partiallytrapped' && pokemon.volatiles['partialtrappinglock'] && target === pokemon.volatiles['partialtrappinglock'].locked) {
			accuracy = true;
		}

		// If a sleep inducing move is used while the user is recharging, the accuracy is true.
		if (move.status === 'slp' && target && target.volatiles['mustrecharge']) {
			accuracy = true;
		}

		// Calculate true accuracy for gen 1, which uses 0-255.
		if (accuracy !== true) {
			accuracy = Math.floor(accuracy * 255 / 100);
			// Check also for accuracy modifiers.
			if (!move.ignoreAccuracy) {
				if (pokemon.boosts.accuracy > 0) {
					accuracy *= boostTable[pokemon.boosts.accuracy];
				} else {
					accuracy = Math.floor(accuracy / boostTable[-pokemon.boosts.accuracy]);
				}
			}
			if (!move.ignoreEvasion) {
				if (target.boosts.evasion > 0 && !move.ignorePositiveEvasion) {
					accuracy = Math.floor(accuracy / boostTable[target.boosts.evasion]);
				} else if (target.boosts.evasion < 0) {
					accuracy *= boostTable[-target.boosts.evasion];
				}
			}
		}
		accuracy = this.runEvent('Accuracy', target, pokemon, move, accuracy);
		// Moves that target the user do not suffer from the 1/256 miss chance.
		if (move.target === 'self' && accuracy !== true) accuracy++;

		// 1/256 chance of missing always, no matter what. Besides the aforementioned exceptions.
		if (accuracy !== true && this.random(256) >= accuracy) {
			this.attrLastMove('[miss]');
			this.add('-miss', pokemon);
			damage = false;
		}

		// Check if the Pokémon is immune to this move.
		if (move.affectedByImmunities && !target.runImmunity(move.type, true)) {
			damage = false;
		}

		// If damage is 0 and not false it means it didn't miss, let's calc.
		if (damage !== false) {
			pokemon.lastDamage = 0;
			if (move.multihit) {
				var hits = move.multihit;
				if (hits.length) {
					// Yes, it's hardcoded... meh
					if (hits[0] === 2 && hits[1] === 5) {
						hits = [2, 2, 3, 3, 4, 5][this.random(6)];
					} else {
						hits = this.random(hits[0], hits[1] + 1);
					}
				}
				hits = Math.floor(hits);
				// In gen 1, all the hits have the same damage for multihits move
				var moveDamage = 0;
				var firstDamage;
				var i;
				for (i = 0; i < hits && target.hp && pokemon.hp; i++) {
					if (i === 0) {
						// First hit, we calculate
						moveDamage = this.moveHit(target, pokemon, move);
						firstDamage = moveDamage;
					} else {
						// We get the previous damage to make it fix damage
						move.damage = firstDamage;
						moveDamage = this.moveHit(target, pokemon, move);
					}
					if (moveDamage === false) break;
					damage = (moveDamage || 0);
					if (target.subFainted) {
						i++;
						break;
					}
				}
				move.damage = null;
				if (i === 0) return true;
				this.add('-hitcount', target, i);
			} else {
				damage = this.moveHit(target, pokemon, move);
			}
		}

		if (move.category !== 'Status') target.gotAttacked(move, damage, pokemon);

		// Checking if substitute fainted
		if (target.subFainted) doSelfDestruct = false;
		if (move.selfdestruct && doSelfDestruct) {
			this.faint(pokemon, pokemon, move);
		}

		// The move missed.
		if (!damage && damage !== 0) {
			// Delete the partial trap lock if necessary.
			delete pokemon.volatiles['partialtrappinglock'];
			return false;
		}

		if (!move.negateSecondary) {
			this.singleEvent('AfterMoveSecondary', move, null, target, pokemon, move);
			this.runEvent('AfterMoveSecondary', target, pokemon, move);
		}

		return damage;
	},
	// move Hit can be found on scripts.js
	// It deals with the actual move hit, as the name indicates, dealing damage and/or effects.
	// This function also deals with the Gen 1 Substitute behaviour on the hitting process.
	moveHit: function (target, pokemon, move, moveData, isSecondary, isSelf) {
		var damage = 0;
		move = this.getMoveCopy(move);

		if (!isSecondary && !isSelf) this.setActiveMove(move, pokemon, target);
		var hitResult = true;
		if (!moveData) moveData = move;

		if (typeof move.affectedByImmunities === 'undefined') {
			move.affectedByImmunities = (move.category !== 'Status');
		}

		// We get the sub to the target to see if it existed
		var targetSub = (target) ? target.volatiles['substitute'] : false;
		var targetHadSub = (targetSub !== null && targetSub !== false && (typeof targetSub !== 'undefined'));

		if (target) {
			hitResult = this.singleEvent('TryHit', moveData, {}, target, pokemon, move);

			// Handle here the applying of partial trapping moves to Pokémon with Substitute
			if (targetSub && moveData.volatileStatus && moveData.volatileStatus === 'partiallytrapped') {
				target.addVolatile(moveData.volatileStatus, pokemon, move);
			}

			if (!hitResult) {
				if (hitResult === false) this.add('-fail', target);
				return false;
			}

			// Only run the hit events for the hit itself, not the secondary or self hits
			if (!isSelf && !isSecondary) {
				hitResult = this.runEvent('TryHit', target, pokemon, move);
				if (!hitResult) {
					if (hitResult === false) this.add('-fail', target);
					// Special Substitute hit flag
					if (hitResult !== 0) {
						return false;
					}
				}
				if (!this.runEvent('TryFieldHit', target, pokemon, move)) {
					return false;
				}
			} else if (isSecondary && !moveData.self) {
				hitResult = this.runEvent('TrySecondaryHit', target, pokemon, moveData);
			}

			if (hitResult === 0) {
				target = null;
			} else if (!hitResult) {
				if (hitResult === false) this.add('-fail', target);
				return false;
			}
		}

		if (target) {
			var didSomething = false;

			damage = this.getDamage(pokemon, target, moveData);

			// getDamage has several possible return values:
			//
			//   a number:
			//     means that much damage is dealt (0 damage still counts as dealing
			//     damage for the purposes of things like Static)
			//   false:
			//     gives error message: "But it failed!" and move ends
			//   null:
			//     the move ends, with no message (usually, a custom fail message
			//     was already output by an event handler)
			//   undefined:
			//     means no damage is dealt and the move continues
			//
			// basically, these values have the same meanings as they do for event
			// handlers.

			if ((damage || damage === 0) && !target.fainted) {
				if (move.noFaint && damage >= target.hp) {
					damage = target.hp - 1;
				}
				damage = this.damage(damage, target, pokemon, move);
				if (!(damage || damage === 0)) return false;
				didSomething = true;
			} else if (damage === false && typeof hitResult === 'undefined') {
				this.add('-fail', target);
			}
			if (damage === false || damage === null) {
				return false;
			}
			if (moveData.boosts && !target.fainted) {
				this.boost(moveData.boosts, target, pokemon, move);
			}
			if (moveData.heal && !target.fainted) {
				var d = target.heal(Math.floor(target.maxhp * moveData.heal[0] / moveData.heal[1]));
				if (!d) {
					this.add('-fail', target);
					return false;
				}
				this.add('-heal', target, target.getHealth);
				didSomething = true;
			}
			if (moveData.status) {
				// Gen 1 bug: If the target has just used hyperbeam and must recharge, its status will be ignored and put to sleep.
				// This does NOT revert the paralyse speed drop or the burn attack drop.
				if (!target.status || moveData.status === 'slp' && target.volatiles['mustrecharge']) {
					target.setStatus(moveData.status, pokemon, move);
				} else if (!isSecondary) {
					if (target.status === moveData.status) {
						this.add('-fail', target, target.status);
					} else {
						this.add('-fail', target);
					}
				}
				didSomething = true;
			}
			if (moveData.forceStatus) {
				if (target.setStatus(moveData.forceStatus, pokemon, move)) {
					didSomething = true;
				}
			}
			if (moveData.volatileStatus) {
				if (target.addVolatile(moveData.volatileStatus, pokemon, move)) {
					didSomething = true;
				}
			}
			if (moveData.sideCondition) {
				if (target.side.addSideCondition(moveData.sideCondition, pokemon, move)) {
					didSomething = true;
				}
			}
			if (moveData.pseudoWeather) {
				if (this.addPseudoWeather(moveData.pseudoWeather, pokemon, move)) {
					didSomething = true;
				}
			}
			// Hit events
			hitResult = this.singleEvent('Hit', moveData, {}, target, pokemon, move);
			if (!isSelf && !isSecondary) {
				this.runEvent('Hit', target, pokemon, move);
			}
			if (!hitResult && !didSomething) {
				if (hitResult === false) this.add('-fail', target);
				return false;
			}
		}
		var targetHasSub = false;
		if (target) {
			var targetSub = target.getVolatile('substitute');
			if (targetSub !== null) {
				targetHasSub = (targetSub.hp > 0);
			}
		}

		// Here's where self effects are applied.
		var doSelf = (targetHadSub && targetHasSub) || !targetHadSub;
		if (moveData.self && (doSelf || moveData.self.volatileStatus === 'partialtrappinglock')) {
			this.moveHit(pokemon, pokemon, move, moveData.self, isSecondary, true);
		}

		// Now we can save the partial trapping damage.
		if (pokemon.volatiles['partialtrappinglock']) {
			pokemon.volatiles['partialtrappinglock'].damage = pokemon.lastDamage;
		}

		// Apply move secondaries.
		if (moveData.secondaries) {
			for (var i = 0; i < moveData.secondaries.length; i++) {
				// We check here whether to negate the probable secondary status if it's para, burn, or freeze.
				// In the game, this is checked and if true, the random number generator is not called.
				// That means that a move that does not share the type of the target can status it.
				// If a move that was not fire-type would exist on Gen 1, it could burn a Pokémon.
				if (!(moveData.secondaries[i].status && moveData.secondaries[i].status in {'par':1, 'brn':1, 'frz':1} && target && target.hasType(move.type))) {
					var effectChance = Math.floor(moveData.secondaries[i].chance * 255 / 100);
					if (typeof moveData.secondaries[i].chance === 'undefined' || this.random(256) < effectChance) {
						this.moveHit(target, pokemon, move, moveData.secondaries[i], true, isSelf);
					}
				}
			}
		}
		if (move.selfSwitch && pokemon.hp) {
			pokemon.switchFlag = move.selfSwitch;
		}

		return damage;
	},
	// boost can be found on battle-engine.js on Battle object.
	// It deals with Pokémon stat boosting, including Gen 1 buggy behaviour with burn and paralyse.
	boost: function (boost, target, source, effect) {
		if (this.event) {
			if (!target) target = this.event.target;
			if (!source) source = this.event.source;
			if (!effect) effect = this.effect;
		}
		if (!target || !target.hp) return 0;
		effect = this.getEffect(effect);
		boost = this.runEvent('Boost', target, source, effect, Object.clone(boost));
		for (var i in boost) {
			var currentBoost = {};
			currentBoost[i] = boost[i];
			if (boost[i] !== 0 && target.boostBy(currentBoost)) {
				var msg = '-boost';
				if (boost[i] < 0) {
					msg = '-unboost';
					boost[i] = -boost[i];
					// Re-add attack and speed drops if not present
					if (i === 'atk' && target.status === 'brn' && !target.volatiles['brnattackdrop']) {
						target.addVolatile('brnattackdrop');
					}
					if (i === 'spe' && target.status === 'par' && !target.volatiles['parspeeddrop']) {
						target.addVolatile('parspeeddrop');
					}
				} else {
					// Check for boost increases deleting attack or speed drops
					if (i === 'atk' && target.status === 'brn' && target.volatiles['brnattackdrop']) {
						target.removeVolatile('brnattackdrop');
					}
					if (i === 'spe' && target.status === 'par' && target.volatiles['parspeeddrop']) {
						target.removeVolatile('parspeeddrop');
					}
				}
				if (effect.effectType === 'Move') {
					this.add(msg, target, i, boost[i]);
				} else {
					this.add(msg, target, i, boost[i], '[from] ' + effect.fullname);
				}
				this.runEvent('AfterEachBoost', target, source, effect, currentBoost);
			}
		}
		this.runEvent('AfterBoost', target, source, effect, boost);
	},
	// damage can be found in battle-engine.js on the Battle object. Not to confuse with BattlePokemon.prototype.damage
	// It calculates and executes the damage damage from source to target with effect.
	// It also deals with recoil and drains.
	damage: function (damage, target, source, effect) {
		if (this.event) {
			if (!target) target = this.event.target;
			if (!source) source = this.event.source;
			if (!effect) effect = this.effect;
		}
		if (!target || !target.hp) return 0;
		effect = this.getEffect(effect);
		if (!(damage || damage === 0)) return damage;
		if (damage !== 0) damage = this.clampIntRange(damage, 1);

		if (effect.id !== 'struggle-recoil') { // Struggle recoil is not affected by effects
			damage = this.runEvent('Damage', target, source, effect, damage);
			if (!(damage || damage === 0)) {
				this.debug('damage event failed');
				return damage;
			}
		}
		if (damage !== 0) damage = this.clampIntRange(damage, 1);
		if (!(effect.id in {'recoil':1, 'drain':1})) target.battle.lastDamage = damage;
		damage = target.damage(damage, source, effect);
		if (source) source.lastDamage = damage;
		var name = effect.fullname;
		if (name === 'tox') name = 'psn';
		switch (effect.id) {
		case 'partiallytrapped':
			this.add('-damage', target, target.getHealth, '[from] ' + this.effectData.sourceEffect.fullname, '[partiallytrapped]');
			break;
		default:
			if (effect.effectType === 'Move') {
				this.add('-damage', target, target.getHealth);
			} else if (source && source !== target) {
				this.add('-damage', target, target.getHealth, '[from] ' + effect.fullname, '[of] ' + source);
			} else {
				this.add('-damage', target, target.getHealth, '[from] ' + name);
			}
			break;
		}

		if (effect.recoil && source) {
			this.damage(this.clampIntRange(Math.floor(damage * effect.recoil[0] / effect.recoil[1]), 1), source, target, 'recoil');
		}
		if (effect.drain && source) {
			this.heal(this.clampIntRange(Math.floor(damage * effect.drain[0] / effect.drain[1]), 1), source, target, 'drain');
		}

		if (target.fainted || target.hp <= 0) {
			this.faint(target);
			this.queue = [];
		} else {
			damage = this.runEvent('AfterDamage', target, source, effect, damage);
		}

		return damage;
	},
	// directDamage can be found on battle-engine.js in Battle object
	// It deals direct damage damage from source to target with effect.
	// It also deals with Gen 1 weird Substitute behaviour.
	directDamage: function (damage, target, source, effect) {
		if (this.event) {
			if (!target) target = this.event.target;
			if (!source) source = this.event.source;
			if (!effect) effect = this.effect;
		}
		if (!target || !target.hp) return 0;
		if (!damage) return 0;
		damage = this.clampIntRange(damage, 1);
		// Check here for Substitute on confusion since it's not exactly a move that causes the damage and thus it can't TryMoveHit.
		// The hi jump kick recoil also hits the sub.
		if (effect.id in {'confusion': 1, 'highjumpkick': 1} && target.volatiles['substitute']) {
			target.volatiles['substitute'].hp -= damage;
			if (target.volatiles['substitute'].hp <= 0) {
				target.removeVolatile('substitute');
				target.subFainted = true;
			} else {
				this.add('-activate', target, 'Substitute', '[damage]');
			}
		} else {
			damage = target.damage(damage, source, effect);
			// Now we sent the proper -damage.
			switch (effect.id) {
			case 'strugglerecoil':
				this.add('-damage', target, target.getHealth, '[from] recoil');
				break;
			case 'confusion':
				this.add('-damage', target, target.getHealth, '[from] confusion');
				break;
			default:
				this.add('-damage', target, target.getHealth);
				break;
			}
			if (target.fainted) this.faint(target);
		}

		return damage;
	},
	// getDamage can be found on battle-engine.js on the Battle object.
	// It calculates the damage pokemon does to target with move.
	getDamage: function (pokemon, target, move, suppressMessages) {
		// First of all, we get the move.
		if (typeof move === 'string') move = this.getMove(move);
		if (typeof move === 'number') move = {
			basePower: move,
			type: '???',
			category: 'Physical'
		};

		// Let's see if the target is immune to the move.
		if (move.affectedByImmunities) {
			if (!target.runImmunity(move.type, true)) {
				return false;
			}
		}

		// Is it an OHKO move?
		if (move.ohko) {
			// If it is, move hits if the Pokémon is faster.
			if (target.speed > pokemon.speed) {
				this.add('-failed', target);
				return false;
			}
			return target.maxhp;
		}

		// We edit the damage through move's damage callback if necessary.
		if (move.damageCallback) {
			return move.damageCallback.call(this, pokemon, target);
		}

		// We take damage from damage=level moves (seismic toss).
		if (move.damage === 'level') {
			return pokemon.level;
		}

		// If there's a fix move damage, we return that.
		if (move.damage) {
			return move.damage;
		}

		// If it's the first hit on a Normal-type partially trap move, it hits Ghosts anyways but damage is 0.
		if (move.volatileStatus === 'partiallytrapped' && move.type === 'Normal' && target.hasType('Ghost')) {
			return 0;
		}

		// Let's check if we are in middle of a partial trap sequence to return the previous damage.
		if (pokemon.volatiles['partialtrappinglock'] && (target === pokemon.volatiles['partialtrappinglock'].locked)) {
			return pokemon.volatiles['partialtrappinglock'].damage;
		}

		// We check the category and typing to calculate later on the damage.
		if (!move.category) move.category = 'Physical';
		if (!move.defensiveCategory) move.defensiveCategory = move.category;
		// '???' is typeless damage: used for Struggle and Confusion etc
		if (!move.type) move.type = '???';
		var type = move.type;

		// We get the base power and apply basePowerCallback if necessary.
		var basePower = move.basePower;
		if (move.basePowerCallback) {
			basePower = move.basePowerCallback.call(this, pokemon, target, move);
		}

		// We check if the base power is proper.
		if (!basePower) {
			if (basePower === 0) return; // Returning undefined means not dealing damage
			return basePower;
		}
		basePower = this.clampIntRange(basePower, 1);

		// Checking for the move's Critical Hit possibility. We check if it's a 100% crit move, otherwise we calculate the chance.
		move.crit = move.willCrit || false;
		if (!move.crit) {
			// In gen 1, the critical chance is based on speed.
			// First, we get the base speed, divide it by 2 and floor it. This is our current crit chance.
			var critChance = Math.floor(pokemon.template.baseStats['spe'] / 2);

			// Now we check for focus energy volatile.
			if (pokemon.volatiles['focusenergy']) {
				// If it exists, crit chance is divided by 2 again and floored.
				critChance = Math.floor(critChance / 2);
			} else {
				// Normally, without focus energy, crit chance is multiplied by 2 and capped at 255 here.
				critChance = this.clampIntRange(critChance * 2, 1, 255);
			}

			// Now we check for the move's critical hit ratio.
			if (move.critRatio === 1) {
				// Normal hit ratio, we divide the crit chance by 2 and floor the result again.
				critChance = Math.floor(critChance / 2);
			} else if (move.critRatio === 2) {
				// High crit ratio, we multiply the result so far by 4 and cap it at 255.
				critChance = this.clampIntRange(critChance * 4, 1, 255);
			}

			// Last, we check deppending on ratio if the move critical hits or not.
			// We compare our critical hit chance against a random number between 0 and 255.
			// If the random number is lower, we get a critical hit. This means there is always a 1/255 chance of not hitting critically.
			if (critChance > 0) {
				move.crit = (this.random(256) < critChance);
			}
		}

		// Happens after crit calculation.
		if (basePower) {
			basePower = this.runEvent('BasePower', pokemon, target, move, basePower);
			if (move.basePowerModifier) {
				basePower *= move.basePowerModifier;
			}
		}
		if (!basePower) return 0;
		basePower = this.clampIntRange(basePower, 1);

		// We now check attacker's and defender's stats.
		var level = pokemon.level;
		var attacker = pokemon;
		var defender = target;
		if (move.useTargetOffensive) attacker = target;
		if (move.useSourceDefensive) defender = pokemon;
		var atkType = (move.category === 'Physical') ? 'atk' : 'spa';
		var defType = (move.defensiveCategory === 'Physical') ? 'def' : 'spd';
		var attack = attacker.getStat(atkType);
		var defense = defender.getStat(defType);

		// In the event of a critical hit, the ofense and defense changes are ignored.
		// This includes both boosts and screens.
		// Also, level is doubled in damage calculation.
		if (move.crit) {
			move.ignoreOffensive = true;
			move.ignoreDefensive = true;
			level *= 2;
			if (!suppressMessages) this.add('-crit', target);
		}
		if (move.ignoreOffensive) {
			this.debug('Negating (sp)atk boost/penalty.');
			attack = attacker.getStat(atkType, true, true);
		}
		if (move.ignoreDefensive) {
			this.debug('Negating (sp)def boost/penalty.');
			defense = target.getStat(defType, true);
		}

		// When either attack or defense are higher than 256, they are both divided by 4 and moded by 256.
		// This is what cuases the roll over bugs.
		if (attack >= 256 || defense >= 256) {
			attack = this.clampIntRange(Math.floor(attack / 4) % 256, 1);
			// Defense isn't checked on the cartridge, but we don't want those / 0 bugs on the sim.
			defense = this.clampIntRange(Math.floor(defense / 4) % 256, 1);
		}

		// Self destruct moves halve defense at this point.
		if (move.selfdestruct && defType === 'def') {
			defense = this.clampIntRange(Math.floor(defense / 2), 1);
		}

		// Let's go with the calculation now that we have what we need.
		// We do it step by step just like the game does.
		var damage = level * 2;
		damage = Math.floor(damage / 5);
		damage += 2;
		damage *= basePower;
		damage *= attack;
		damage = Math.floor(damage / defense);
		damage = this.clampIntRange(Math.floor(damage / 50), 1, 997);
		damage += 2;

		// STAB damage bonus, the "???" type never gets STAB
		if (type !== '???' && pokemon.hasType(type)) {
			damage += Math.floor(damage / 2);
		}

		// Type effectiveness.
		// The order here is not correct, must change to check the move versus each type.
		var totalTypeMod = this.getEffectiveness(type, target);
		// Super effective attack
		if (totalTypeMod > 0) {
			if (!suppressMessages) this.add('-supereffective', target);
			damage *= 20;
			damage = Math.floor(damage / 10);
			if (totalTypeMod >= 2) {
				damage *= 20;
				damage = Math.floor(damage / 10);
			}
		}
		if (totalTypeMod < 0) {
			if (!suppressMessages) this.add('-resisted', target);
			damage *= 5;
			damage = Math.floor(damage / 10);
			if (totalTypeMod <= -2) {
				damage *= 5;
				damage = Math.floor(damage / 10);
			}
		}

		// If damage becomes 0, the move is made to miss.
		// This occurs when damage was either 2 or 3 prior to applying STAB/Type matchup, and target is 4x resistant to the move.
		if (damage === 0) return damage;

		// Apply random factor is damage is greater than 1
		if (damage > 1) {
			damage *= this.random(217, 256);
			damage = Math.floor(damage / 255);
			if (damage > target.hp && !target.volatiles['substitute']) damage = target.hp;
			if (target.volatiles['substitute'] && damage > target.volatiles['substitute'].hp) damage = target.volatiles['substitute'].hp;
		}

		// And we are done.
		return Math.floor(damage);
	},
	// This is random teams making for gen 1.
	// Challenge Cup or CC teams are basically fully random teams.
	randomCCTeam: function (side) {
		var teamdexno = [];
		var team = [];

		// Pick six random Pokémon, no repeats.
		for (var i = 0; i < 6; i++) {
			while (true) {
				var x = Math.floor(Math.random() * 151) + 1;
				if (teamdexno.indexOf(x) === -1) {
					teamdexno.push(x);
					break;
				}
			}
		}

		for (var i = 0; i < 6; i++) {
			// Choose forme.
			var formes = [];
			for (var j in this.data.Pokedex) {
				if (this.data.Pokedex[j].num === teamdexno[i] && this.getTemplate(this.data.Pokedex[j].species).learnset && this.data.Pokedex[j].species !== 'Pichu-Spiky-eared') {
					formes.push(this.data.Pokedex[j].species);
				}
			}
			var poke = formes.sample();
			var template = this.getTemplate(poke);

			// Level balance: calculate directly from stats rather than using some silly lookup table.
			var mbstmin = 1307; // sunkern has the lowest modified base stat total, and that total is 807
			var stats = template.baseStats;

			// Modified base stat total assumes 30 IVs, 255 EVs in every stat
			var mbst = (stats["hp"] * 2 + 30 + 63 + 100) + 10;
			mbst += (stats["atk"] * 2 + 30 + 63 + 100) + 5;
			mbst += (stats["def"] * 2 + 30 + 63 + 100) + 5;
			mbst += (stats["spa"] * 2 + 30 + 63 + 100) + 5;
			mbst += (stats["spd"] * 2 + 30 + 63 + 100) + 5;
			mbst += (stats["spe"] * 2 + 30 + 63 + 100) + 5;

			var level = Math.floor(100 * mbstmin / mbst); // Initial level guess will underestimate

			while (level < 100) {
				mbst = Math.floor((stats["hp"] * 2 + 30 + 63 + 100) * level / 100 + 10);
				mbst += Math.floor(((stats["atk"] * 2 + 30 + 63 + 100) * level / 100 + 5) * level / 100); //since damage is roughly proportional to lvl
				mbst += Math.floor((stats["def"] * 2 + 30 + 63 + 100) * level / 100 + 5);
				mbst += Math.floor(((stats["spa"] * 2 + 30 + 63 + 100) * level / 100 + 5) * level / 100);
				mbst += Math.floor((stats["spd"] * 2 + 30 + 63 + 100) * level / 100 + 5);
				mbst += Math.floor((stats["spe"] * 2 + 30 + 63 + 100) * level / 100 + 5);

				if (mbst >= mbstmin)
					break;
				level++;
			}

			// Random DVs
			var ivs = {
				hp: Math.floor(Math.random() * 30),
				atk: Math.floor(Math.random() * 30),
				def: Math.floor(Math.random() * 30),
				spa: Math.floor(Math.random() * 30),
				spd: Math.floor(Math.random() * 30),
				spe: Math.floor(Math.random() * 30)
			};

			// ALl EVs
			var evs = {
				hp: 255,
				atk: 255,
				def: 255,
				spa: 255,
				spd: 255,
				spe: 255
			};

			// Four random unique moves from movepool. don't worry about "attacking" or "viable".
			var moves;
			var pool = ['struggle'];
			pool = Object.keys(template.learnset);
			if (pool.length <= 4) {
				moves = pool;
			} else {
				moves = pool.sample(4);
			}

			team.push({
				name: poke,
				moves: moves,
				ability: 'None',
				evs: evs,
				ivs: ivs,
				item: '',
				level: level,
				happiness: 0,
				shiny: false,
				nature: 'Serious'
			});
		}

		return team;
	},
	// Random team generation for Gen 1 Random Battles.
	randomTeam: function (side) {
		// Get what we need ready.
		var keys = [];
		var pokemonLeft = 0;
		var pokemon = [];
		var i = 1;

		// We need to check it's one of the first 151 because formats data are installed onto main format data, not replaced.
		for (var n in this.data.FormatsData) {
			if (this.data.FormatsData[n].randomBattleMoves && i < 152) {
				keys.push(n);
			}
			i++;
		}
		keys = keys.randomize();

		// Now let's store what we are getting.
		var typeCount = {};
		var weaknessCount = {'electric':0, 'psychic':0, 'water':0, 'ice':0};
		var uberCount = 0;
		var nuCount = 0;
		var hasShitmon = false;

		for (var i = 0; i < keys.length && pokemonLeft < 6; i++) {
			var template = this.getTemplate(keys[i]);
			if (!template || !template.name || !template.types) continue;

			// Bias the tiers so you get less shitmons and only one of the two Ubers.
			// If you have a shitmon, you're covered in OUs and Ubers if possible
			var tier = template.tier;
			if (tier === 'LC' && (nuCount > 1 || hasShitmon)) continue;
			if ((tier === 'NFE' || tier === 'UU') && (hasShitmon || (nuCount > 2 && this.random(1)))) continue;
			// Unless you have one of the worst mons, in that case we allow luck to give you both Mew and Mewtwo.
			if (tier === 'Uber' && uberCount >= 1 && !hasShitmon) continue;

			// We need a weakness count of spammable attacks to avoid being swept by those.
			// Spammable attacks are: Thunderbolt, Psychic, Surf, Blizzard.
			var skip = false;
			Object.keys(weaknessCount).forEach(function (type) {
				var notImmune = Tools.getImmunity(type, template);
				if (notImmune && Tools.getEffectiveness(type, template) > 0) {
					weaknessCount[type]++;
				}
				if (weaknessCount[type] > 2) skip = true;
			});
			if (skip) continue;

			// Limit 2 of any type as well. Diversity and minor weakness count.
			// The second of a same type has halved chance of being added.
			var types = template.types;
			for (var t = 0; t < types.length; t++) {
				if (typeCount[types[t]] > 1 || (typeCount[types[t]] === 1 && this.random(1))) {
					skip = true;
					break;
				}
			}
			if (skip) continue;

			// The set passes the limitations.
			var set = this.randomSet(template, i);
			pokemon.push(set);

			// Now let's increase the counters. First, the Pokémon left.
			pokemonLeft++;

			// Type counter.
			for (var t = 0; t < types.length; t++) {
				if (types[t] in typeCount) {
					typeCount[types[t]]++;
				} else {
					typeCount[types[t]] = 1;
				}
			}

			// Increment type bias counters.
			if (tier === 'Uber') {
				uberCount++;
			} else if (tier === 'UU' || tier === 'NFE' || tier === 'LC') {
				nuCount++;
			}

			// Is it Magikarp?
			if (keys[i] in {'magikarp':1, 'weedle':1, 'kakuna':1, 'caterpie':1, 'metapod':1, 'ditto':1}) hasShitmon = true;
		}

		return pokemon;
	},
	// Random set generation for Gen 1 Random Battles.
	randomSet: function (template, i) {
		if (i === undefined) i = 1;
		template = this.getTemplate(template);
		if (!template.exists) template = this.getTemplate('pikachu'); // Because Gen 1.

		var moveKeys = template.randomBattleMoves;
		moveKeys = moveKeys.randomize();
		var moves = [];
		var hasType = {};
		hasType[template.types[0]] = true;
		if (template.types[1]) hasType[template.types[1]] = true;
		var hasMove = {};
		var counter = {};
		var setupType = '';

		var j = 0;
		do {
			// Choose next 4 moves from learnset/viable moves and add them to moves list:
			var howMany = (template.essentialMove) ? 3 : 4;
			while (moves.length < howMany && j < moveKeys.length) {
				var moveid = toId(moveKeys[j]);
				j++;
				moves.push(moveid);
			}

			// Add now the mandatory move
			if (template.essentialMove) {
				moves.unshift(template.essentialMove);
				j++;
			}

			// Only do move choosing if we have more than four on the moveset...
			if (moveKeys.length > howMany) {
				hasMove = {};
				counter = {Physical: 0, Special: 0, Status: 0, physicalsetup: 0, specialsetup: 0};
				for (var k = 0; k < moves.length; k++) {
					var move = this.getMove(moves[k]);
					var moveid = move.id;
					hasMove[moveid] = true;
					if (!move.damage && !move.damageCallback) {
						counter[move.category]++;
					}
					if ({swordsdance:1, sharpen:1}[moveid]) {
						counter['physicalsetup']++;
					}
					if ({amnesia:1, growth:1}[moveid]) {
						counter['specialsetup']++;
					}
				}

				if (counter['specialsetup']) {
					setupType = 'Special';
				} else if (counter['physicalsetup']) {
					setupType = 'Physical';
				}

				for (var k = 0; k < moves.length; k++) {
					var moveid = moves[k];
					var move = this.getMove(moveid);
					var rejected = false;
					if (hasMove[moveid]) rejected = true;
					if (!template.essentialMove || moveid !== template.essentialMove) {
						var isSetup = false;

						switch (moveid) {
						// bad after setup
						case 'seismictoss': case 'nightshade':
							if (setupType) rejected = true;
							break;
						// bit redundant to have both
						case 'flamethrower':
							if (hasMove['fireblast']) rejected = true;
							break;
						case 'fireblast':
							if (hasMove['flamethrower']) rejected = true;
							break;
						case 'icebeam':
							if (hasMove['blizzard']) rejected = true;
							break;
						// Hydropump and surf are both valid options, just avoid one with eachother.
						case 'hydropump':
							if (hasMove['surf']) rejected = true;
							break;
						case 'surf':
							if (hasMove['hydropump']) rejected = true;
							break;
						case 'petaldance': case 'solarbeam':
							if (hasMove['megadrain'] || hasMove['razorleaf']) rejected = true;
							break;
						case 'megadrain':
							if (hasMove['razorleaf']) rejected = true;
							break;
						case 'thunder':
							if (hasMove['thunderbolt']) rejected = true;
							break;
						case 'thunderbolt':
							if (hasMove['thunder']) rejected = true;
							break;
						case 'bonemerang':
							if (hasMove['earthquake']) rejected = true;
							break;
						case 'rest':
							if (hasMove['recover'] || hasMove['softboiled']) rejected = true;
							break;
						case 'softboiled':
							if (hasMove['recover']) rejected = true;
							break;
						case 'sharpen':
						case 'swordsdance':
							if (counter['Special'] > counter['Physical'] || hasMove['slash'] || !counter['Physical'] || hasMove['growth']) rejected = true;
							break;
						case 'growth':
							if (counter['Special'] < counter['Physical'] || hasMove['swordsdance']) rejected = true;
							break;
						case 'doubleedge':
							if (hasMove['bodyslam']) rejected = true;
							break;
						case 'mimic':
							if (hasMove['mirrormove']) rejected = true;
							break;
						case 'superfang':
							if (hasMove['bodyslam']) rejected = true;
							break;
						case 'rockslide':
							if (hasMove['earthquake'] && hasMove['bodyslam'] && hasMove['hyperbeam']) rejected = true;
							break;
						case 'bodyslam':
							if (hasMove['thunderwave']) rejected = true;
							break;
						case 'bubblebeam':
							if (hasMove['blizzard']) rejected = true;
							break;
						case 'screech':
							if (hasMove['slash']) rejected = true;
							break;
						case 'slash':
							if (hasMove['swordsdance']) rejected = true;
							break;
						case 'megakick':
							if (hasMove['bodyslam']) rejected = true;
							break;
						case 'eggbomb':
							if (hasMove['hyperbeam']) rejected = true;
							break;
						case 'triattack':
							if (hasMove['doubleedge']) rejected = true;
							break;
						case 'growth':
							if (hasMove['amnesia']) rejected = true;
							break;
						case 'supersonic':
							if (hasMove['confuseray']) rejected = true;
							break;
						case 'poisonpowder':
							if (hasMove['toxic'] || counter['Status'] > 1) rejected = true;
							break;
						case 'stunspore':
							if (hasMove['sleeppowder'] || counter['Status'] > 1) rejected = true;
							break;
						case 'sleeppowder':
							if (hasMove['stunspore'] || counter['Status'] > 2) rejected = true;
							break;
						case 'toxic':
							if (hasMove['sleeppowder'] || hasMove['stunspore'] || counter['Status'] > 1) rejected = true;
							break;
						} // End of switch for moveid
					}
					if (rejected && j < moveKeys.length) {
						moves.splice(k, 1);
						break;
					}
					counter[move.category]++;
				} // End of for
			} // End of the check for more than 4 moves on moveset.
		} while (moves.length < 4 && j < moveKeys.length);

		var levelScale = {
			LC: 96,
			NFE: 90,
			UU: 85,
			OU: 79,
			Uber: 74
		};
		// Really bad Pokemon and jokemons, MEWTWO, Pokémon with higher tier in Wrap metas.
		var customScale = {
			Caterpie: 99, Kakuna: 99, Magikarp: 99, Metapod: 99, Weedle: 99,
			Clefairy: 95, "Farfetch'd": 99, Jigglypuff: 99, Ditto: 99, Mewtwo: 70,
			Dragonite: 85, Cloyster: 83, Staryu: 90
		};
		var level = levelScale[template.tier] || 90;
		if (customScale[template.name]) level = customScale[template.name];
		if (template.name === 'Mewtwo' && hasMove['amnesia']) level = 68;

		return {
			name: template.name,
			moves: moves,
			ability: 'None',
			evs: {hp: 255, atk: 255, def: 255, spa: 255, spd: 255, spe: 255},
			ivs: {hp: 30, atk: 30, def: 30, spa: 30, spd: 30, spe: 30},
			item: '',
			level: level,
			shiny: false,
			gender: false
		};
	}
};

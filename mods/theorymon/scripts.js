exports.BattleScripts = {
	init: function () {
		this.modData('Pokedex', 'archeops').abilities['1'] = 'Vital Spirit';
		this.modData('Pokedex', 'porygonz').types = ['Normal', 'Ghost'];
		this.modData('Pokedex', 'weezing').types = ['Poison', 'Steel'];
		this.modData('Pokedex', 'moltres').abilities['1'] = 'Magic Guard';
		this.modData('Pokedex', 'abomasnowmega').abilities['0'] = 'Technician';
		this.modData('Pokedex', 'cradily').abilities['1'] = 'Sand Stream';
		this.modData('Pokedex', 'froslass').abilities['1'] = 'Prankster';
		this.modData('Learnsets', 'absol').learnset.partingshot = ['6T'];
		this.modData('Pokedex', 'goodra').abilities['1'] = 'Protean';
		this.modData('Pokedex', 'entei').abilities['1'] = 'Defiant';
		this.modData('Pokedex', 'milotic').abilities['H'] = 'Multiscale';
		this.modData('Pokedex', 'empoleon').abilities['1'] = 'Lightning Rod';
		this.modData('Learnsets', 'reuniclus').learnset.voltswitch = ['6T'];
		this.modData('Pokedex', 'steelixmega').abilities['0'] = 'Arena Trap';
		this.modData('Pokedex', 'audinomega').abilities['0'] = 'Simple';
		this.modData('Learnsets', 'ampharos').learnset.wish = ['6T'];
		this.modData('Pokedex', 'absolmega').types = ['Dark', 'Fairy'];
		this.modData('Pokedex', 'weavile').abilities['1'] = 'Moxie';
		this.modData('Learnsets', 'pangoro').learnset.suckerpunch = ['6T'];
		this.modData('Pokedex', 'rotomfan').types = ['Electric', 'Steel'];
		this.modData('Learnsets', 'rotomfan').learnset.flashcannon = this.data.Learnsets.rotomfan.learnset.airslash;
		this.modData('Learnsets', 'rotomfan').learnset.airslash = null;
		this.modData('Learnsets', 'mantine').learnset.roost = ['6T'];
		this.modData('Learnsets', 'pidgeot').learnset.focusblast = ['6T'];
	}
};

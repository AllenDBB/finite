/**
 * The Studio: Artist of the Day plugin
 * This is a daily activity where users nominate the featured artist for the day, which is selected randomly once voting has ended.
 * Only works in a room with the id 'thestudio'
 */

function toArtistId(artist) { // toId would return '' for foreign/sadistic artists
	return artist.toLowerCase().replace(/\s/g, '').replace(/\b&\b/g, '');
}

var artistOfTheDay = {
	pendingNominations: false,
	nominations: new Map(),
	removedNominators: []
};

var theStudio = Rooms.get('thestudio');
if (theStudio && !theStudio.plugin) {
	theStudio.plugin = artistOfTheDay;
}

var commands = {
	start: function (target, room, user) {
		if (room.id !== 'thestudio' || !room.chatRoomData || !this.can('mute', null, room)) return false;
		if (artistOfTheDay.pendingNominations) return this.sendReply('Nominations for the Artist of the Day are already in progress.');

		var nominations = artistOfTheDay.nominations;
		var prenominations = room.chatRoomData.prenominations;
		if (prenominations && prenominations.length) {
			for (var i = prenominations.length; i--;) {
				var prenomination = prenominations[i];
				nominations.set(Users.get(prenomination[0].userid) || prenomination[0], prenomination[1]);
			}
		}

		artistOfTheDay.pendingNominations = true;
		room.chatRoomData.prenominations = [];
		Rooms.global.writeChatRoomData();
		room.addRaw('<div class="broadcast-blue"><strong>Nominations for the Artist of the Day have begun!</strong><br />' +
		            'Use /aotd nom to nominate an artist.</div>');
		this.privateModCommand('(' + user.name + ' began nominations for the Artist of the Day.)');
	},

	end: function (target, room, user) {
		if (room.id !== 'thestudio' || !room.chatRoomData || !this.can('mute', null, room)) return false;
		if (!artistOfTheDay.pendingNominations) return this.sendReply('Nominations for the Artist of the Day are not in progress.');
		if (!artistOfTheDay.nominations.size) return this.sendReply('No nominations have been submitted yet.');

		var nominations = Array.from(artistOfTheDay.nominations.values());
		var artist = nominations[~~Math.random(nominations.length)];
		artistOfTheDay.pendingNominations = false;
		artistOfTheDay.nominations.clear();
		artistOfTheDay.removedNominators = [];
		room.chatRoomData.artistOfTheDay = artist;
		Rooms.global.writeChatRoomData();
		room.addRaw('<div class="broadcast-blue"><strong>Nominations for the Artist of the Day have ended!</strong><br />' +
		            'Randomly selected artist: ' + Tools.escapeHTML(artist) + '</div>');
		this.privateModCommand('(' + user.name + ' ended nominations for the Artist of the Day.)');
	},

	prenom: function (target, room, user) {
		if (room.id !== 'thestudio' || !room.chatRoomData || !target) return false;
		if (artistOfTheDay.pendingNominations) return this.sendReply('Nominations for the Artist of the Day are in progress.');
		if (!room.chatRoomData.prenominations) room.chatRoomData.prenominations = [];

		var userid = user.userid;
		var ips = user.ips;
		var prenominationId = toArtistId(target);
		if (!prenominationId) return this.sendReply('' + target + ' is not a valid artist name.');
		if (toArtistId(room.chatRoomData.artistOfTheDay) === prenominationId) return this.sendReply('' + target + ' is already the current Artist of the Day.');

		var prenominations = room.chatRoomData.prenominations;
		var prenominationIndex = -1;
		var latestIp = user.latestIp;
		for (var i = prenominations.length; i--;) {
			if (toArtistId(prenominations[i][1]) === prenominationId) return this.sendReply('' + target + ' has already been prenominated.');

			if (prenominationIndex < 0) {
				var prenominator = prenominations[i][0];
				if (prenominator.userid === userid || prenominator.ips[latestIp]) prenominationIndex = i;
			}
		}

		if (prenominationIndex > -1) {
			prenominations[prenominationIndex][1] = target;
			Rooms.global.writeChatRoomData();
			return this.sendReply('Your prenomination was changed to ' + target + '.');
		}

		prenominations.push([{name: user.name, userid: userid, ips: user.ips}, target]);
		Rooms.global.writeChatRoomData();
		this.sendReply('' + target + ' was submitted for the next nomination period for the Artist of the Day.');
	},

	nom: function (target, room, user) {
		if (room.id !== 'thestudio' || !room.chatRoomData) return false;
		if (!artistOfTheDay.pendingNominations) return this.sendReply('Nominations for the Artist of the Day are not in progress.');

		var removedNominators = artistOfTheDay.removedNominators;
		if (removedNominators.indexOf(user) > -1) return this.sendReply('Since your nomination has been removed, you cannot submit another artist until the next round.');

		var alts = user.getAlts();
		for (var i = removedNominators.length; i--;) {
			if (alts.indexOf(removedNominators[i].name) > -1) return this.sendReply('Since your nomination has been removed, you cannot submit another artist until the next round.');
		}

		var nominationId = toArtistId(target);
		if (toArtistId(room.chatRoomData.artistOfTheDay) === nominationId) return this.sendReply('' + target + ' was the last Artist of the Day.');

		var userid = user.userid;
		var latestIp = user.latestIp;
		for (var data, nominationsIterator = artistOfTheDay.nominations.entries(); !!(data = nominationsIterator.next().value);) { // replace with for-of loop once available
			var nominator = data[0];
			if (nominator.ips[latestIp] && nominator.userid !== userid || alts.indexOf(nominator.name) > -1) return this.sendReply('You have already submitted a nomination for the Artist of the Day under the name ' + nominator.name + '.');
			if (toArtistId(data[1]) === nominationId) return this.sendReply('' + target + ' has already been nominated.');
		}

		var response = '' + user.name + (artistOfTheDay.nominations.has(user) ? ' changed their nomination from ' + artistOfTheDay.nominations.get(user) + ' to ' + target + '.' : ' nominated ' + target + ' for the Artist of the Day.');
		artistOfTheDay.nominations.set(user, target);
		this.send(response);
	},

	viewnoms: function (target, room, user) {
		if (room.id !== 'thestudio' || !room.chatRoomData) return false;

		var buffer = '';
		if (!artistOfTheDay.pendingNominations) {
			if (!user.can('mute', null, room)) return false;

			var prenominations = room.chatRoomData.prenominations;
			if (!prenominations || !prenominations.length) return this.sendReplyBox('No prenominations have been submitted yet.');

			var i = prenominations.length;
			buffer += 'Current prenominations:';
			while (i--) {
				buffer += '<br />- ' + Tools.escapeHTML(prenominations[i][1]) + ' (submitted by ' + Tools.escapeHTML(prenominations[i][0].name) + ')';
			}
			return this.sendReplyBox(buffer);
		}

		if (!this.canBroadcast()) return false;
		if (!artistOfTheDay.nominations.size) return this.sendReplyBox('No nominations have been submitted yet.');

		var nominations = Array.from(artistOfTheDay.nominations.entries()).sort(function (a, b) {
			if (a[1] < b[1]) return 1;
			if (a[1] > b[1]) return -1;
			return 0;
		});
		var i = nominations.length;
		buffer += 'Current nominations:';
		while (i--) {
			buffer += '<br />- ' + Tools.escapeHTML(nominations[i][1]) + ' (submitted by ' + Tools.escapeHTML(nominations[i][0].name) + ')';
		}
		this.sendReplyBox(buffer);
	},

	removenom: function (target, room, user) {
		if (room.id !== 'thestudio' || !room.chatRoomData || !target || !this.can('mute', null, room)) return false;
		if (!artistOfTheDay.pendingNominations) return this.sendReply('Nominations for the Artist of the Day are not in progress.');
		if (!artistOfTheDay.nominations.size) return this.sendReply('No nominations have been submitted yet.');

		target = this.splitTarget(target);
		var name = this.targetUsername;
		var userid = toId(name);
		if (!userid) return this.sendReply('"' + name + '" is not a valid username.');

		for (var nominator, nominatorsIterator = artistOfTheDay.nominations.keys(); !!(nominator = nominatorsIterator.next().value);) { // replace with for-of loop once available
			if (nominator.userid === userid) {
				artistOfTheDay.nominations.delete(nominator);
				artistOfTheDay.removedNominators.push(nominator);
				return this.privateModCommand('(' + user.name + ' removed ' + nominator.name + '\'s nomination for the Artist of the Day.)');
			}
		}

		this.sendReply('User "' + name + '" has no nomination for the Artist of the Day.');
	},

	set: function (target, room, user) {
		if (room.id !== 'thestudio' || !room.chatRoomData || !this.can('mute', null, room)) return false;
		if (!toId(target)) return this.sendReply('No valid artist was specified.');
		if (artistOfTheDay.pendingNominations) return this.sendReply('The Artist of the Day cannot be set while nominations are in progress.');

		room.chatRoomData.artistOfTheDay = target;
		Rooms.global.writeChatRoomData();
		this.privateModCommand('(' + user.name + ' set the Artist of the Day to ' + target + '.)');
	},

	'': function (target, room) {
		if (room.id !== 'thestudio' || !room.chatRoomData || !this.canBroadcast()) return false;
		this.sendReplyBox('The Artist of the Day ' + (room.chatRoomData.artistOfTheDay ? 'is ' + room.chatRoomData.artistOfTheDay + '.' : 'has not been set yet.'));
	},

	help: function (target, room) {
		if (room.id !== 'thestudio' || !room.chatRoomData || !this.canBroadcast()) return false;
		this.sendReplyBox('The Studio: Artist of the Day plugin commands:<br />' +
		                  '- /aotd - View the Artist of the Day.<br />' +
				  '- /aotd start - Start nominations for the Artist of the Day. Requires: % @ # & ~<br />' +
				  '- /aotd nom - Nominate an artist for the Artist of the Day.<br />' +
				  '- /aotd viewnoms - View the current nominations for the Artist of the Day. Requires: % @ # & ~<br />' +
				  '- /aotd removenom [username] - Remove a user\'s nomination for the Artist of the Day and prevent them from voting again until the next round. Requires: % @ # & ~<br />' +
				  '- /aotd end - End nominations for the Artist of the Day and set it to a randomly selected artist. Requires: % @ # & ~<br />' +
				  '- /aotd prenom - Nominate an artist for the Artist of the Day between nomination periods.<br />' +
				  '- /aotd set [artist] - Set the Artist of the Day. Requires: % @ # & ~');
	}
};

exports.commands = {
	aotd: commands
};

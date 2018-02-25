//+=========================================+
//||					   ||
//||		RANKING METHODS		   ||
//||					   ||
//+==========================================+

/**
 * Adds an owo point if 10s has passed for each user
 * @param {mysql.Connection}	con - Mysql.createConnection()
 * @param {discord.Message}	msg - Discord's message
 *
 */
exports.addPoint = function(con,msg){
	var id = msg.author.id;
	var guild = msg.guild;
	var text = msg.content.replace(/(\n)+/g," | ");
	try{
		var sql = "SELECT id FROM timeout WHERE id = "+id+" AND TIMESTAMPDIFF(HOUR,time,NOW()) < 1"
		con.query(sql,function(err,result){
			if(result[0]!=null||result[0]!=undefined){
				console.log("-["+msg.guild.name+"]["+msg.channel.name+"]["+msg.channel.id+"]"+msg.author.username+" typed '"+text+"'");
			}else{
				sql = "SET @add = 0;SET @diff = TIMESTAMPDIFF(SECOND,(SELECT lasttime FROM user WHERE id = "+id+"),NOW());"+
				"UPDATE user SET spamcount = IF(ABS(previnterval-@diff)<=1,spamcount+1,0),previnterval = IF(@diff>10000 AND @diff>9,0,@diff) WHERE id = "+id+";"+
				"INSERT INTO user (id,count,lasttime) VALUES ("+id+",1,NOW()) ON DUPLICATE KEY UPDATE count = count + IF(@diff>10 AND spamcount < 11,@add:=1,@add:=0),lasttime = NOW();"+
				"INSERT INTO guild (id,count) VALUES ("+guild.id+",1) ON DUPLICATE KEY UPDATE count = count + @add;SELECT spamcount FROM user WHERE id = "+id+";"+
				"INSERT INTO cowoncy (id,money) VALUES ("+id+",1) ON DUPLICATE KEY UPDATE money = money + @add;";
				con.query(sql,function(err,result){
					if(err){ throw err; return;}
					var spam = result[5][0].spamcount;
					if(msg.channel.type==="text")
						console.log("["+msg.guild.name+"]["+msg.channel.name+"]["+msg.channel.id+"]"+msg.author.username+" typed '"+text+"'");
					else
						console.log("[DM]"+msg.author.username+" typed "+text);
					if(spam>=10){
						console.log("	Spam detected!");
						sql = "INSERT INTO timeout (id,time) VALUES ("+id+",NOW()) ON DUPLICATE KEY UPDATE time = NOW();";
						con.query(sql,function(err,result){
							console.log("	Putting user in timeout");
							msg.author.send("***OwO What's This?!?***\nYou have been timed out for 1H due to spam or macros!\nIf you feel like this is a mistake, use `owo feedback` in a channel to get it fixed!");
						});
					}

				});
			}
		});
	}catch(err){

	}
}

/**
 * Check for valid arguments to display leaderboards
 * @param {mysql.Connection}	con 	- Mysql.createConnection()
 * @param {discord.Client}	client	- Discord.js's client
 * @param {discord.Message}	msg 	- Discord's message
 * @param {string[]}		args 	- Command arguments
 */
exports.display = function(con, client, msg, args){
	var members = msg.guild.members;
	var channel = msg.channel;
	//Check if its disabled
	var sql = "SELECT * FROM blacklist WHERE id = "+channel.id+";";

	con.query(sql,function(err,rows,fields){
		if(err) throw err;
		var length = rows.length;
		if(rows.length>0){
			channel.send("'owo rank' is disabled on this channel!");
			console.log("	Command Disabled");
			return;
		}else{
			//check for args
			var global = false;
			var guild = false;
			var money = false;
			var zoo = false;
			var invalid = false;
			var count = 5;
			if(args.length==1||args.length==2){
				for(var i in args){
					if(!global&&!guild&&!money&&!zoo){
						if(args[i]=== "global")
							global = true;
						else if(args[i]==="guild"||args[i]==="server")
							guild = true;
						else if(args[i]=== "zoo")
							zoo = true;
						else if(args[i]=== "cowoncy"||args[i]==="money")
							money = true;
					}else if(isInt(args[i]))
						count = parseInt(args[i]);
					else
						invalid = true;
				}
				if (count>25) count = 25;
				else if (count<1) count = 5;
			}
			if(invalid)
				msg.channel.send("Invalid ranking type!");
			else if(global)
				getGlobalRanking(con, client, channel, count);
			else if(guild)
				getGuildRanking(con, client, channel, count);
			else if(zoo)
				getGlobalZooRanking(con, client, channel, count);
			else
				getRanking(con, client, msg.guild.id, members, channel, count);	
		}
	});
}

/**
 * displays guild ranking
 * @param {mysql.Connection}	con 	- Mysql.createConnection()
 * @param {discord.User[]}	members	- Guild's members
 * @param {discord.Channel}	channel - Current channel
 * @param {int} 		count 	- number of ranks to display
 */
function getRanking(con, client, guildId, members, channel, count){
	//Grabs top 5
	var sql = "SELECT * FROM user WHERE id IN ( ";
	members.keyArray().forEach(function(ele){
		sql = sql + ele + ",";
	});
	sql = sql.slice(0,-1) + " ) ORDER BY count DESC LIMIT "+count+";";
	sql   +=  "SELECT id,count,(SELECT COUNT(*)+1 FROM guild WHERE count > g.count) AS rank FROM guild g WHERE g.id = "+guildId+";";

	//Create an embeded message
	con.query(sql,function(err,rows,fields){
		if(err) throw err;
		var rank = 1;
		var ranking = [];
		var embed = "```md\n< Top "+count+" OwO Rankings for "+client.guilds.get(guildId)+" >\n";
		if(rows[1][0]!==undefined&&rows[1][0]!==null){
			embed += "> Guild Rank: "+rows[1][0].rank+"\n";
			embed += ">\t\tcollectively said owo "+rows[1][0].count+" times!\n\n";
		}
		rows[0].forEach(function(ele){
			var id = String(ele.id);
			var nickname = members.get(id).nickname;
			var name = "";
			if(nickname)
				name = nickname+" ("+members.get(id).user.username+")";
			else
				name = ""+members.get(id).user.username;
			name = name.replace("discord.gg","discord,gg");
			embed += "#"+rank+"\t"+name+"\n\t\tsaid owo "+ele.count+" times!\n";
			rank++;
		});
		var date = new Date();
		embed += ("\n*Spamming owo will not count!!!* | "+date.getMonth()+"/"+date.getDate()+"/"+date.getFullYear()+" "+date.getHours()+":"+date.getMinutes()+"```");
		channel.send(embed);

	});
	console.log("	Displaying top "+count);
}

/**
 * displays global ranking
 * @param {mysql.Connection}	con 	- Mysql.createConnection()
 * @param {mysql.Client}	client	- Discord.js's client
 * @param {discord.Channel}	channel - Current channel
 * @param {int} 		count 	- number of ranks to display
 */
function getGlobalRanking(con, client, channel, count){
	//Grabs top 5
	var sql = "SELECT * FROM user ORDER BY count DESC LIMIT "+count+";";

	//Create an embeded message
	con.query(sql,function(err,rows,fields){
		if(err) throw err;
		var rank = 1;
		var ranking = [];
		var embed = "```md\n< Top "+count+" Global OwO Rankings >\n\n";
		rows.forEach(function(ele){
			var id = String(ele.id);
			var user = client.users.get(id);
			var name = "";
			if(user === undefined || user.username === undefined)
				name = "User Left Bot";
			else
				name = ""+user.username;
			name = name.replace("discord.gg","discord,gg");
			embed += "#"+rank+"\t"+name+"\n\t\tsaid owo "+ele.count+" times!\n";
			rank++;
		});
		var date = new Date();
		embed += ("\n*Spamming owo will not count!!!* | "+date.getMonth()+"/"+date.getDate()+"/"+date.getFullYear()+" "+date.getHours()+":"+date.getMinutes()+"```");
		channel.send(embed);
	});
	console.log("	Displaying top "+count+" global");
}

/**
 * Checks if its an integer
 * @param {string}	value - value to check if integer
 *
 */
function isInt(value){
	return !isNaN(value) &&
		parseInt(Number(value)) == value &&
		!isNaN(parseInt(value,10));
}

/**
 * displays guild ranking
 * @param {mysql.Connection}	con 	- Mysql.createConnection()
 * @param {mysql.Client}	client	- Discord.js's client
 * @param {discord.Channel}	channel - Current channel
 * @param {int} 		count 	- number of ranks to display
 */
function getGuildRanking(con, client, channel, count){
	//Grabs top 5
	var sql = "SELECT * FROM guild ORDER BY count DESC LIMIT "+count+";";

	//Create an embeded message
	con.query(sql,function(err,rows,fields){
		if(err) throw err;
		var rank = 1;
		var ranking = [];
		var embed = "```md\n< Top "+count+" Guild OwO Rankings >\n\n";
		rows.forEach(function(ele){
			var id = String(ele.id);
			var guild = client.guilds.get(id);
			var name = "";
			if(guild === undefined || guild.name=== undefined)
				name = "Guild Left Bot";
			else
				name = ""+guild.name;
			name = name.replace("discord.gg","discord,gg");
			embed += "#"+rank+"\t"+name+"\n\t\tcollectively said owo "+ele.count+" times!\n";
			rank++;
		});
		var date = new Date();
		embed += ("\n*Spamming owo will not count!!!* | "+date.getMonth()+"/"+date.getDate()+"/"+date.getFullYear()+" "+date.getHours()+":"+date.getMinutes()+"```");
		channel.send(embed);
	});
	console.log("	Displaying top "+count+" guilds");
}

/**
 * displays global zoo ranking
 * @param {mysql.Connection}	con 	- Mysql.createConnection()
 * @param {mysql.Client}	client	- Discord.js's client
 * @param {discord.Channel}	channel - Current channel
 * @param {int} 		count 	- number of ranks to display
 */
function getGlobalZooRanking(con, client, channel, count){
	//Grabs top 5
	var sql = "SELECT id,SUM(points*count) AS points, "+
		"SUM((CASE rank WHEN 'c' THEN 1 ELSE 0 END)*count) AS common, "+
		"SUM((CASE rank WHEN 'u' THEN 1 ELSE 0 END)*count) AS uncommon, "+
		"SUM((CASE rank WHEN 'r' THEN 1 ELSE 0 END)*count) AS rare, "+
		"SUM((CASE rank WHEN 'e' THEN 1 ELSE 0 END)*count) AS epic, "+
		"SUM((CASE rank WHEN 'm' THEN 1 ELSE 0 END)*count) AS mythical "+ 
		"FROM animal NATURAL JOIN animal_rank NATURAL JOIN rank_points GROUP BY id ORDER BY points DESC LIMIT "+count+";";

	//Create an embeded message
	con.query(sql,function(err,rows,fields){
		if(err) throw err;
		var rank = 1;
		var ranking = [];
		var embed = "```md\n< Top "+count+" Global Zoo Rankings >\n\n";
		rows.forEach(function(ele){
			var id = String(ele.id);
			var user = client.users.get(id);
			var name = "";
			if(user === undefined || user.username === undefined)
				name = "User Left Bot";
			else
				name = ""+user.username;
			name = name.replace("discord.gg","discord,gg");
			embed += "#"+rank+"\t"+name+"\n\t\t"+ele.points+" zoo points: ";
			embed += "M-"+ele.mythical+", ";
			embed += "E-"+ele.epic+", ";
			embed += "R-"+ele.rare+", ";
			embed += "U-"+ele.uncommon+", ";
			embed += "C-"+ele.common+"\n";
			rank++;
		});
		var date = new Date();
		embed += ("\n"+date.getMonth()+"/"+date.getDate()+"/"+date.getFullYear()+" "+date.getHours()+":"+date.getMinutes()+"```");
		channel.send(embed);
	});
	console.log("	Displaying top "+count+" global zoo");
}



/**
 * Checks if its an integer
 * @param {string}	value - value to check if integer
 *
 */
function isInt(value){
	return !isNaN(value) &&
		parseInt(Number(value)) == value &&
		!isNaN(parseInt(value,10));
}
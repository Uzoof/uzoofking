const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { DisTube } = require('distube');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { token, clientId } = require('./config.json');

// Bot oluştur
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// DisTube v4 başlat
const distube = new DisTube(client, {
  emitNewSongOnly: true,
  leaveOnEmpty: true,
});

// Slash komutlar
const commands = [
  {
    name: 'oynat',
    description: 'Bir şarkı çalar.',
    options: [
      {
        name: 'şarkı',
        description: 'Çalmak istediğiniz şarkı (YouTube linki veya arama)',
        type: 3,
        required: true
      }
    ]
  },
  { name: 'geç', description: 'Bir sonraki şarkıya geçer.' },
  { name: 'kuyruk', description: 'Mevcut çalma kuyruğunu gösterir.' },
  { name: 'durdur', description: 'Çalmayı durdurur.' },
  { name: 'kuyruktemizle', description: 'Çalma kuyruğunu temizler.' },
  { name: 'duraklat', description: 'Mevcut şarkıyı duraklatır.' },
  { name: 'devam', description: 'Durdurulmuş şarkıyı devam ettirir.' }
];

// Komutları Discord'a yükle
const rest = new REST({ version: '9' }).setToken(token);
(async () => {
  try {
    console.log('Komutlar yükleniyor...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Komutlar başarıyla yüklendi!');
  } catch (error) {
    console.error('Komut yükleme hatası:', error);
  }
})();

// Bot hazır olduğunda
client.on('ready', () => console.log(`Bot olarak giriş yapıldı: ${client.user.tag}`));

// Slash komut yönetimi
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;
  const voiceChannel = interaction.member.voice.channel;

  if (!voiceChannel && ['oynat', 'geç', 'durdur', 'duraklat', 'devam', 'kuyruktemizle'].includes(commandName))
    return interaction.reply('Öncelikle bir ses kanalına katılmalısınız!');

  try {
    const queue = distube.getQueue(interaction);

    if (commandName === 'oynat') {
      const query = options.getString('şarkı');
      const isURL = /^(https?:\/\/)/.test(query);

      await interaction.deferReply();

      let song;
      if (isURL) {
        song = await distube.play(voiceChannel, query, {
          member: interaction.member,
          textChannel: interaction.channel
        });
      } else {
        const results = await distube.search(query, { limit: 1 });
        if (!results || results.length === 0) return interaction.editReply('Aradığınız şarkı bulunamadı.');
        song = await distube.play(voiceChannel, results[0].url, {
          member: interaction.member,
          textChannel: interaction.channel
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('🎵 Şarkı çalınıyor')
        .setDescription(song.name)
        .setURL(song.url)
        .setThumbnail(song.thumbnail)
        .setColor('Blue');

      return interaction.editReply({ embeds: [embed] });

    } else if (commandName === 'geç') {
      if (!queue) return interaction.reply('Şu anda atlayabileceğiniz bir şarkı yok.');
      distube.skip(interaction);
      return interaction.reply('⏭ Bir sonraki şarkıya geçildi.');

    } else if (commandName === 'kuyruk') {
      if (!queue) return interaction.reply('Şu anda çalma kuyruğu boş.');
      const songList = queue.songs.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
      return interaction.reply(`🎶 Mevcut çalma kuyruğu:\n${songList}`);

    } else if (commandName === 'durdur') {
      if (!queue) return interaction.reply('Şu anda çalan şarkı yok.');
      distube.stop(interaction);
      return interaction.reply('⏹ Çalma durduruldu.');

    } else if (commandName === 'kuyruktemizle') {
      if (!queue) return interaction.reply('Şu anda çalma kuyruğu boş.');
      distube.stop(interaction);
      return interaction.reply('🗑 Çalma kuyruğu temizlendi.');

    } else if (commandName === 'duraklat') {
      if (!queue) return interaction.reply('Şu anda çalan şarkı yok.');
      if (queue.paused) return interaction.reply('Şarkı zaten duraklatılmış.');
      queue.pause();
      return interaction.reply('⏸ Şarkı duraklatıldı.');

    } else if (commandName === 'devam') {
      if (!queue) return interaction.reply('Şu anda çalan şarkı yok.');
      if (!queue.paused) return interaction.reply('Şarkı zaten çalıyor.');
      queue.resume();
      return interaction.reply('▶ Şarkı devam ettirildi.');
    }
  } catch (error) {
    console.error(error);
    return interaction.editReply(`❌ Hata: ${error.message}`);
  }
});

// DisTube olayları
distube.on('playSong', (queue, song) => {
  queue.textChannel.send(`🎶 Şarkı başladı: **${song.name}**`);
});

distube.on('addSong', (queue, song) => {
  queue.textChannel.send(`➕ Şarkı kuyruğa eklendi: **${song.name}**`);
});

distube.on('error', (channel, error) => {
  console.error(error);
  if (channel) channel.send(`❌ Hata oluştu: ${error.message}`);
});

client.login(token).catch(err => console.error('Token hatası:', err));

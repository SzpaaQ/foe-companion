(() => {
  const idPattern = /^\d{16,22}$/;
  const messageType = 'FOE_DISCORD_API';

  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || !sender.tab || !/^https:\/\/[^/]+\.forgeofempires\.com\//.test(sender.url || '') || message?.type !== messageType) return;
    const token = typeof message.token === 'string' ? message.token.trim() : '';
    const channelId = typeof message.channelId === 'string' ? message.channelId.trim() : '';
    if (!token || token.length > 256 || !idPattern.test(channelId)) {
      reply({ok:false,error:'Uzupełnij token bota i prawidłowe ID kanału.'});
      return;
    }

    const run = async () => {
      let url, method = 'GET', body;
      if (message.action === 'channel') {
        url = `https://discord.com/api/v10/channels/${channelId}`;
      } else if (message.action === 'send' || message.action === 'edit') {
        const messageId = typeof message.messageId === 'string' ? message.messageId.trim() : '';
        if (message.action === 'edit' && !idPattern.test(messageId)) return {ok:false,error:'Brak prawidłowego ID wiadomości do edycji.'};
        if (!message.payload || typeof message.payload !== 'object' || Array.isArray(message.payload)) return {ok:false,error:'Nieprawidłowa treść rozpiski.'};
        method = message.action === 'send' ? 'POST' : 'PATCH';
        url = message.action === 'send'
          ? `https://discord.com/api/v10/channels/${channelId}/messages`
          : `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`;
        body = JSON.stringify({...message.payload, allowed_mentions:{parse:[]}});
      } else {
        return {ok:false,error:'Nieznana operacja Discorda.'};
      }

      let response;
      try {
        response = await fetch(url, {
          method,
          headers:{Authorization:`Bot ${token}`,...(body?{'Content-Type':'application/json'}:{})},
          ...(body?{body}:{}),
          signal:AbortSignal.timeout(12000),
        });
      } catch {
        return {ok:false,error:'Brak połączenia z Discordem.'};
      }
      let data=null;
      try { data=await response.json(); } catch {}
      if (!response.ok) {
        const retry=Number(data?.retry_after);
        const error=response.status===401?'Nieprawidłowy token bota.'
          :response.status===403?'Bot nie ma dostępu do kanału lub wymaganych uprawnień.'
          :response.status===404?'Nie znaleziono kanału albo wiadomości.'
          :response.status===429?'Discord ograniczył tempo zapytań.'
          :`Discord zwrócił błąd HTTP ${response.status}.`;
        return {ok:false,error,action:message.action,status:response.status,...(typeof data?.message==='string'?{discordMessage:data.message}:{}),...(Number.isSafeInteger(data?.code)?{discordCode:data.code}:{}),...(response.status===429&&Number.isFinite(retry)?{retryAfter:retry}:{})};
      }
      if (message.action === 'channel') return {ok:true,channel:{id:data?.id,name:data?.name,type:data?.type}};
      return {ok:true,message:{id:data?.id,author:{id:data?.author?.id}}};
    };
    run().then(reply).catch(()=>reply({ok:false,error:'Nie udało się wykonać żądania do Discorda.'}));
    return true;
  });
})();

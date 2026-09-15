// The bridge embeds only validated IDs, never titles, URLs, or lyric text.
export function buildNativeYouTubeHtml(
  track,
  session,
  initialTime = 0,
  initialPlaylistIndex = 0,
  autoPlay = true,
  initialVolume = 100,
) {
  const config = JSON.stringify({
    session,
    videoId: track.videoId,
    playlistId: track.playlistId,
    kind: track.kind,
    initialTime,
    initialPlaylistIndex,
    autoPlay,
    initialVolume,
  }).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#player{margin:0;width:100%;height:100%;background:#000;overflow:hidden}</style></head><body><div id="player"></div><script>
var config=${config}, player, ready=false, authorized=false, revision=0;
function send(data){ data.session=config.session; window.ReactNativeWebView.postMessage(JSON.stringify(data)); }
function status(extra){
  if(!ready)return;
  var data=player.getVideoData()||{};
  send(Object.assign({type:'status',ready:true,state:player.getPlayerState(),time:player.getCurrentTime()||0,duration:player.getDuration()||0,videoId:data.video_id||'',videoTitle:data.title||'',videoIds:player.getPlaylist()||[],playlistIndex:Math.max(0,player.getPlaylistIndex()||0)},extra||{}));
}
function request(index,initial){ if(!ready)return; send({type:'claim',ticket:++revision,index:index,initial:!!initial}); }
window.shoppCommand=function(command,value,requestId){
  if(!ready){ if(command==='suspend')send({type:'ack',requestId:requestId}); return; }
  if(command==='suspend'){
    revision++; authorized=false; player.mute(); player.pauseVideo();
    var attempts=0;
    function acknowledge(){
      if(player.isMuted() || [0,2,5,-1].indexOf(player.getPlayerState())>=0){send({type:'ack',requestId:requestId});status({state:2});}
      else if(++attempts<80)setTimeout(acknowledge,25);
      else send({type:'ack',requestId:requestId,error:true});
    }
    acknowledge();
  }
  if(command==='grant' && value.ticket===revision){
    authorized=true;
    if(typeof value.index==='number')player.playVideoAt(value.index);
    else if(player.getPlayerState()!==1)player.playVideo();
    player.unMute();
  }
  if(command==='play')request();
  if(command==='select')request(value);
  if(command==='load'&&value&&value.track){
    revision++; authorized=value.autoPlay!==false;
    player.mute();
    var next=value.track, start=Math.max(0,value.time||0), index=Math.max(0,value.playlistIndex||0);
    if(next.kind==='album'&&next.playlistId){
      player.loadPlaylist({list:next.playlistId,index:index,startSeconds:start});
    }else if(next.videoId){
      player.loadVideoById({videoId:next.videoId,startSeconds:start});
    }else{return;}
    if(value.autoPlay!==false)player.unMute();else player.pauseVideo();
    status({state:value.autoPlay!==false?1:2});
  }
  if(command==='seek'){player.seekTo(Math.max(0,value),true);status();}
  if(command==='volume'&&player.setVolume)player.setVolume(Math.max(0,Math.min(100,value)));
};
function onYouTubeIframeAPIReady(){
  var vars={autoplay:0,playsinline:1,rel:0};
  if(config.initialTime>0)vars.start=Math.floor(config.initialTime);
  if(config.kind==='album'){vars.listType='playlist';vars.list=config.playlistId;vars.index=Math.max(0,config.initialPlaylistIndex||0);}
  player=new YT.Player('player',{width:'100%',height:'100%',videoId:config.videoId||undefined,playerVars:vars,events:{
    onReady:function(){ready=true;if(player.setVolume)player.setVolume(Math.max(0,Math.min(100,config.initialVolume)));player.mute();if(config.initialTime>0)player.seekTo(config.initialTime,true);status();setInterval(status,500);if(config.autoPlay)request(undefined,true);},
    onStateChange:function(event){
      if(!ready)return;
      if(event.data===1&&!authorized){player.mute();request();}
      if(event.data===0||event.data===2){authorized=false;player.mute();revision++;}
      status();
    },
    onError:function(event){authorized=false;revision++;player.mute();player.pauseVideo();send({type:'error',code:event.data});},
    onAutoplayBlocked:function(){status({state:2,notice:'Pulsa reproducir para iniciar el vídeo.'});}
  }});
}
var script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
script.onerror=function(){send({type:'error',code:0});};document.head.appendChild(script);
setTimeout(function(){if(!ready)send({type:'error',code:0});},20000);
</script></body></html>`;
}

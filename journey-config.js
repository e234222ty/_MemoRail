/* 案内を追加する場合は steps に同じ scene の項目を追加できます。
   scene: 0=早朝、1=正午、2=夕方、3=夜。
   stopAt: 奇数背景の横幅に対する停車位置（1=近景の2枚目に入る位置）。
   distance: stopAtを指定しない追加案内向けの移動距離（1080px高を基準）。 */
window.MEMORAIL_JOURNEY = {
  version: 2,
  steps: [
    {id:'memory', view:'memory', scene:0, stopAt:1, title:'思い出を入力してください', confirmLabel:'次へ'},
    {id:'words', view:'words', scene:1, stopAt:1, title:'文章の中から消す単語を選んでください', confirmLabel:'次へ'},
    {id:'preview', view:'preview', scene:2, stopAt:1, title:'あなたの思い出のポストカードはこちらです', confirmLabel:'決定'},
    {id:'farewell', view:'outro', scene:3, stopAt:1, title:'だれかの思い出が、届きました。'}
  ],
  // 現段階は架空の体験用サンプル。登録日時も確認用の架空データです。入力内容を外部に送信しません。
  receivedMemories: [
    {username:'夕空の旅人',registeredAt:'2026-11-16T08:30:00+09:00',request:'今日の帰り道に、空の色を少しだけ見上げてみてください。', text:'いつもより少し遠回りした帰り道。川沿いのベンチで、空がオレンジから青に変わるまで話していた。何を話したかは忘れたけれど、あの日の風のやさしさは、今も覚えている。'},
    {username:'雪を待つ旅人',registeredAt:'2026-11-17T10:00:00+09:00',request:'温かい飲み物を手にして、ひと息ついてみてください。', text:'朝、カーテンを開けたら街が真っ白になっていた。まだ足跡のない道を、家族と並んで歩いた。冷たい手に渡された温かい缶のぬくもりを、雪を見るたびに思い出す。'},
    {username:'夏の旅人',registeredAt:'2026-11-18T18:00:00+09:00',request:'身近な音に耳をすませて、好きな音をひとつ探してください。', text:'小さな駅のホームで、祖母と列車を待った夏。かばんに入れてくれた冷たい麦茶と、遠くから聞こえる踏切の音。何でもない待ち時間が、いまは大切な思い出になっている。'}
  ]
};

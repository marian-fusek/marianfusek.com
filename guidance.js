(function(){
  const b=document.querySelector(".bio-b"),i=document.querySelector(".bio-i"),o=document.querySelector(".bio-o");
  if(!b||!i||!o)return;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function loop(){
    while(true){
      b.classList.remove("is-off");i.classList.remove("is-off");o.classList.remove("is-off");
      await wait(1600);
      b.classList.add("is-off");
      await wait(300);
      o.classList.add("is-off");
      await wait(180);
      for(let n=0;n<3;n++){
        i.classList.add("is-off");o.classList.remove("is-off");
        await wait(300);
        i.classList.remove("is-off");o.classList.add("is-off");
        await wait(300);
      }
      i.classList.remove("is-off");o.classList.remove("is-off");
      await wait(250);
      b.classList.remove("is-off");
      await wait(1500);
    }
  }
  loop();
})();

/* ============================================================
   GUIDANCE — Mindset + Team Leadership overlays
   ============================================================ */
(function(){
  const title=document.getElementById('guidanceTitle');
  const overlay=document.getElementById('mfGuidanceOverlay');
  const reviewsHost=document.getElementById('mfGuidanceReviews');
  const reviewNav=document.getElementById('mfGuidanceReviewNav');
  const overlayTitle=document.getElementById('mfGuidanceOverlayTitle');
  const overlayIntro=document.getElementById('mfGuidanceOverlayIntro');
  const kicker=document.getElementById('mfGuidanceKicker');
  const overlayAside=overlay?.querySelector('.mf-guidance-overlay-aside');
  const guidanceSection=document.getElementById('guidance');
  const closeButton=overlay?.querySelector('.mf-guidance-close');
  if(!title||!overlay||!reviewsHost||!reviewNav||!overlayTitle||!overlayIntro||!kicker||!overlayAside||!guidanceSection||!closeButton)return;

  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function runTitle(){
    while(title.isConnected){
      title.classList.remove('is-id','is-clearing');
      await wait(2000);
      title.classList.add('is-id');
      await wait(2000);
      title.classList.add('is-clearing');
      await wait(430);
      title.classList.remove('is-id','is-clearing');
      await wait(4000);
    }
  }
  runTitle();

  const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[char]));
  const nl=value=>Array.isArray(value)?value.map(paragraph=>`<p>${escapeHtml(paragraph)}</p>`).join(''):String(value).split(/\n{2,}/).map(paragraph=>`<p>${escapeHtml(paragraph)}</p>`).join('');
  const flagEmoji={CZ:'🇨🇿',RU:'🇷🇺',FI:'🇫🇮',US:'🇺🇸',SK:'🇸🇰'};
  const flagMarkup=flag=>`<span class="mf-guidance-flag-emoji" data-flag="${escapeHtml(flag)}" aria-hidden="true">${flagEmoji[flag]||'◻'}</span>`;
  const personMarkup=entry=>`<div class="mf-guidance-person"><img class="mf-guidance-person-photo" src="${escapeHtml(entry.photo)}" alt="${escapeHtml(entry.name)}" loading="lazy" decoding="async"><span class="mf-guidance-person-info"><small class="mf-guidance-person-country">${flagMarkup(entry.flag)}<span>${escapeHtml(entry.country)}</span></small><b class="mf-guidance-person-name">${escapeHtml(entry.name)}</b><span class="mf-guidance-person-gap" aria-hidden="true"></span><small class="mf-guidance-person-role">${escapeHtml(entry.role)}</small><small class="mf-guidance-person-company">${escapeHtml(entry.company)}</small></span></div>`;
  const tagsMarkup=entry=>(entry.tags||[]).length?`<div class="mf-guidance-review-tags">${entry.tags.map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div>`:'';
  const weightLinkMarkup=(label,className,href)=>{
    const chars=[...label];
    const letters=chars.map((char,index)=>`<span style="--i:${index};--r:${chars.length-index-1}">${char===' '?'&nbsp;':escapeHtml(char)}</span>`).join('');
    return `<a class="mf-weight-link ${className}" href="${escapeHtml(href)}" target="_blank" rel="noopener" aria-label="${escapeHtml(label)}">${letters}</a>`;
  };

  const revealTextMarkup=label=>[...label].map((char,index)=>`<span class="mf-guidance-next-char" style="--char:${index}">${char===' '?'&nbsp;':escapeHtml(char)}</span>`).join('');
  const guidanceNextMarkup=(label,target)=>`<button class="mf-guidance-next-link" type="button" data-guidance-next="${escapeHtml(target)}" aria-label="Open ${escapeHtml(label.replace('→','').trim())}"><span class="mf-guidance-next-label">${revealTextMarkup(label.replace('→','').trim())}</span><span class="mf-guidance-next-arrow" aria-hidden="true">→</span></button>`;

  const romanReview=[
    `I started seeing Marián because I wanted to do something about my work ethic and discipline. I had left the company to work independently. Work began piling up, and very quickly I no longer knew what to tackle first.`,
    `Marián’s help was invaluable in several ways. As someone new to coaching, he first explained thoroughly how the whole thing worked and how it would unfold. Then, as we worked on the problem itself, his intelligent, perceptive questions led me to answers and solutions that were actually my own. Many things from our sessions are now firmly embedded in my life, and I often think back to the many small pieces of advice and tips I picked up along the way with Marián. A bonus was Marián’s advice and experience from his own remarkably rich professional life, and the completely relaxed Scandinavian-Japanese-style atmosphere.`
  ];

  const darjaReview=[
    `Just like many other product designers out there, I pivoted careers and got into design through courses, books, webinars… basically learning by trial and error. At some point, I found myself completely overwhelmed with information and unsure how to navigate my career further, how to evolve, and what to focus on. That was when I reached out to Marián—not with a clear question, just a bunch of self-doubt. Although I used to be skeptical about the concept of mentoring, I could not miss the opportunity to talk to Marián because I followed and admired his design work. Yet I received so much more than a thorough design review, and I have been the most loyal design-coaching promoter ever since.`,
    `To begin with, Marián created a safe and encouraging space for me to open up and put my thoughts in order. I always came with a problem that seemed unsolvable and always left feeling empowered and uplifted. He is the leader I desperately needed. We talked about pixels and icons, but also long-term goals, personal priorities, and emotional well-being. I received the most on-point design advice, which noticeably took my skills to a completely new level. I gained confidence and, most importantly, understood what my strengths are and how to develop them. As a result, I feel more connected to myself. Marián is a very talented designer and an incredible coach, and I am so grateful for the mentoring sessions that helped me grow on both career and personal levels.`
  ];

  const anastasiiaReview=`Working with Marián when I felt burned out, overwhelmed, and immobilized helped me acknowledge my feelings and rework my self-afflicting beliefs and interactions with the world. Marián can be the venting system you may have needed for a long time, but he can also be an essential part of setting a new course for that stage of your life.`;

  const makoReview=[
    `The coaching sessions helped me shift my paradigms in life. I thought I knew what steps to take to be a “good person,” which included living up to a particular set of standards influenced far more by my surroundings than by myself. Over the sessions, I learned to listen to myself and let myself be me—and everything else would fall into place. One day, I started thinking about the kind of life I could live on my own terms, without always trying to fit into the “successful career woman” mold. Such a simple thought freed my imagination and allowed me to reconsider what I truly valued: fulfilling relationships, authenticity, and a healthy, balanced life—not work. Last week, I had an interview for a job I wanted. I got nervous during the interview and did not feel that I performed the activities well. That night, I was overwhelmed with anxiety and racing thoughts, but I was quickly able to return to my foundations—the loving relationships I have around me. Now I feel okay. If I do not get hired, it will be okay, and I will keep trying elsewhere.`,
    `My diary entry from October 1, 2022:`,
    `Whenever I leave my coaching session, I feel an overwhelming sense of love for myself. That self-love inspires me to naturally do things that are “good” for me, like paint, journal, or even clean the house. I do these things because I want to take care of myself—not out of guilt to be productive. Over the week, that self-love dissipates. I eventually go back to trying to escape my reality by binge-watching TV. But the more I practice being kinder to myself and listening to my intuition, the more I can return to this space of forgiveness and self-love. I want to live on my own terms and figure out what that means for me.`
  ];

  const iljaReview=[
    `Before meeting Marián, my history with coaching was a mixed bag. Until then, I had thought of coaches as self-assured gurus who applied a predefined set of techniques to help you clarify your goals and boost your productivity and performance. My perspective completely shifted after working with Marián. Marián is a highly perceptive and empathetic listener. Whenever my words said one thing but my body language said something else, he picked up on it and used it as an avenue to help me deconstruct my underlying motives and assumptions. What stood out was his ability to quickly understand my personality and temperament and adapt his coaching style to suit me. This knack allowed him to skillfully balance guiding me while encouraging self-direction. Most importantly, Marián was not afraid to nudge me out of my comfort zone, challenging my initial answers and steering me toward deeper reflection.`,
    `Sometimes I found myself leaving a session shaken, yet profoundly contemplative. Other times, I was brimming with inspiration and energy, barely able to contain the excitement and eagerness stirring within me. Both kinds of sessions proved invaluable, offering unique insights into the underlying mental models that drive my personal and professional behavior. A few months into our collaboration, I realized a significant transformation. I did not leave our sessions burdened with a laundry list of goals and benchmarks to meet, which Marián would then hold me accountable for. Instead, I left with a new understanding of myself. I recognized that I did not thrive within rigid structures, something I had already been somewhat aware of. Through my journey with Marián, however, I learned not merely to acknowledge this trait but to harness it as a powerful tool. I can wholeheartedly recommend Marián to anyone looking for a coaching experience that is transformative, personalized, and insightful.`
  ];

  const longReview=[
    `Hi, my name is Michal, and I was born twice in my life. The first time was 29 years ago, and I am grateful to my Mom for that (and my Dad, of course). The second time was six months ago, and I owe that to Marián. You see, I was not always who I am now, and I became this person thanks to him. Actually, thanks to myself—but I would not have been capable of it without him. Complicated, right?`,
    `The fact is, Marián’s presence affected every aspect of my being. For the better. What was the magic? That is the best thing about all of it: there is no magic, and there never was. There is only an incredible ability to listen, and a boundless interest in and attention toward you. When you sit opposite Marián, you are the only person who matters in that moment. No one is more important than you. As if no one else had ever existed.`,
    `When I first met Marián, I was fairly convinced I knew who I was and who I needed to become. I had an idea of myself and my desires—everything I had to fit into my life, everything I had to achieve. Those were all the things that would make me happy. What I will be grateful to Marián for until the day I die is that he did not help me achieve any of them. Instead, he helped me realize that none of them were my dreams or goals, let alone the foundation of my happiness. They were the dreams and goals of other people. Strangers. People I know nothing about and probably never will. (What do those people even know about themselves?) Dreams someone sold me and I bought willingly and thoughtlessly. Very little of it came from me, from my personality, or from knowing myself. It was only with Marián that we discovered me: what I truly want, what gives me energy, and what takes it away. And that brings us to a major affliction of today’s world. Many people will tell you what is best for you. They will sell it to you or offer it for free. Based on their own experience or someone else’s, they will advise you on how to achieve success, fame, and happiness as a finished product. Yet not one of them makes even the slightest effort to know and understand you sincerely—to understand what it is like to be YOU. To discover you. They think that what worked for them must work for others. So they give advice. But that is nothing more than vanity disguised as goodwill, and advice aimed blindly. Instead of showing you a direction, they entangle you even further and lead you farther away from yourself. If happiness has ever existed in this world, you already have it within you; you simply have not discovered it. YET. And that is what Marián helped me understand—and that understanding is the key to everything!`,
    `Marián sincerely believes there is no universal advice, no universal path to happiness. The only right path is your own, and no one has ever published a map of it. How could they? It is up to you to discover that path and find out what lies along it. No one can tell you when and where to turn, let alone where you are supposed to arrive. You probably do not know that yourself. YET. No one has ever walked that path before, so no one can tell you what will be waiting there. But someone can help you prepare for it and pack your backpack. YOUR own backpack, equipped with everything you might need along the way so that nothing catches you unprepared. They will not fill it with what other people needed, but with what you need. I am immensely grateful that I was able to pack mine with Marián. I now know there is no one else I would rather have packed it with. I cannot imagine anyone doing it with such genuine interest in my journey as he did. When you allow the right person to know you better than you may know yourself, it is as if your older self were preparing you for the road. Thank you, Marián, for being my older self, just as you are the older self of all your “bodies,” as you call them.`,
    `I leave my work with Marián a free, self-aware person, able to interpret my life in my own favor, whatever happens in it. You cannot always control which cards land on the table or whether you run into snakes in the sand along the way (Marián will never promise otherwise). But you can always play as well as you possibly can, despite everything and everyone. You can always enjoy your game, your journey, so that one day you can calmly say, from a good place: I followed my own path, and it was a ride no one else experienced. And perhaps, through that, inspire others never to stop searching for their own path for a very good reason, and never to settle for anything less. That is what this is all about. Thank you, my friend, for teaching me to play as if my life depended on it!`
  ];

  const splitReviewAt=(text,marker)=>{
    const index=text.indexOf(marker);
    return index<0?[text,'']:[text.slice(0,index).trim(),text.slice(index).trim()];
  };
  const [michalDiscoveryLead,michalDiscoveryTail]=splitReviewAt(longReview[2],'It was only with Marián that we discovered me:');
  const [michalPathLead,michalPathTail]=splitReviewAt(longReview[3],'I am immensely grateful that I was able to pack mine with Marián.');
  const michalParts=[
    [longReview[0],longReview[1],michalDiscoveryLead],
    [michalDiscoveryTail,michalPathLead],
    [michalPathTail,longReview[4]]
  ];

  const tomasLodnanReview=[
    `I have to say, we had many mentors and consultants. Many of them helped us move forward, gave us feedback and created a space where we could talk about our challenges despite the daily routine.`,
    `Marián was on another level for us. To be honest, I was extremely surprised by how quickly and precisely he was able to understand who we are, what our challenges are and identify the problems without any unnecessary fluff. His presentation was so valuable that I went through it several times. :) Based on his suggestions and his ability to identify potential issues in the future, we made important changes to our organisational structure and prioritised our focus on areas where we had pain points.`,
    `Marián continues to be our long-term mentor and coach. We regularly return to discuss specific topics and validate whether he confirms that our approach is good or provides a different perspective. If your organisation is growing and you are seeking an expert in leadership and team management for your tech company, Marián is definitely the person I would recommend first.`
  ];

  const kristynaPeckovaReview=[
    `When I started in design several years ago, I was looking for someone who could open the door to that world and help me launch my career. Marián became one of the key people who guided me through that process. His support, advice and knowledge were indispensable to me, and thanks to him I found courage and confidence in my abilities. Marián gave me foundational design knowledge, explained it in a practical and entertaining way, gave me constructive feedback on my designs and stood by me when I landed my first client. His coaching and support contributed significantly to building my confidence in design and in my personal life.`,
    `It is great to see how he has combined two things he genuinely enjoys—design and coaching. There is no question that he is a great designer, but I am glad I could be part of his professional growth and see him develop as a coach and share his know-how with others with such passion. I can only recommend working with him in any capacity!`
  ];

  const jakubNesporReview=`I would say I have a pretty good history with Marián. He was there for me during the most crucial phase of my career as my Team Leader, always striking the right balance between friendliness and professionalism. He introduced me to the fundamentals of coaching, so it is no surprise that, even years later, he was there to lend a hand when I needed it. What I love most about our sessions is how authentic they are, even when things are not always smooth sailing. And my favorite part? Leaving! Not because I am eager to go home, but because I always feel so pumped and happy that I have just learned something new about myself.`;

  const tomasBruzdaReview=`I have been attending sessions with Marián in waves. We have already gone through two waves. The first dealt with both personal and work life a bit. The second was primarily about work life. Regardless, in both cases, I left very satisfied. Marián helped me organize my thoughts, set priorities and, most importantly, figure out what I really want. Even when we did not have a specific topic to address, it helped me a lot just to vent about what was bothering me. Sometimes we followed up on something, sometimes we did not, but I always left with peace of mind. If a third wave comes, it will certainly be with Marián again.`;

  const marosNovakReview=[
    `After eight years as iOS Lead at GoodRequest, I started wondering what should come next. The team was finely tuned, with no weak links—technologically strong and motivated—while I found myself digging deeper into how the company operated. Around that time, we invited Marián to come in and look at the company from a distance. After years inside it, we lacked that perspective because we were deep in operations, business and everyday problems. During our conversation, he wanted to understand how we worked, and he asked exactly the questions I needed to answer but had never asked myself.`,
    `One of the outcomes after his week with us was the recommendation that the tech leaders needed a leader: a Head of Design & Engineering who would motivate them, listen to them, help guide them and launch them to the moon. Simply someone who would be there for them in the same way they were there for their teams. The recommendation came with my name, followed by an offer from the board asking whether I was in. I was. Naturally, I had respect and concerns, but I was not alone in it—we started sessions with Marián.`,
    `Our coaching sessions are pure gold. Whether I was looking for a replacement for myself on the iOS platform and thinking about how to tell the team, figuring out how to take the right first steps as Head of D&E, preparing for difficult conversations or finding ways to connect the tech leads more closely, we found answers to everything together—or rather, I found them. Marián asked the questions. His empathy, spark, ability to step out of the role and precisely targeted advice make me feel more confident in what I do. Our leadership styles are similar, and our vibe and shared perspective help me immensely. Also thanks to lines like: “Hey, I’m here for you,” “Let’s make this easier for you,” “I’m rooting for you,” “Go take what’s yours,” and “This is the shit.”`
  ];

  const marieLaurenReview=`Coaching with Marián recharges your batteries and gives you so much energy to move forward that you feel like a Duracell. We’ve had sessions in both lighter and more difficult moments, but the result was always the same—a smile on my face and the strength to take action, choose what matters and throw the rest overboard. Every hour with him saved me so many others that I would otherwise have lost, had it not been for his perceptive questions to reflect on.`;

  const mindsetEntries=[
    {id:'michal-bohac',length:'big-parts',name:'Michal Boháč',role:'CEO',company:'Wonder Makers',country:'Czechia',flag:'CZ',photo:'/media/guidance/coaching/michal-bohac.jpg',tags:['Transformational Coaching'],copy:longReview,parts:michalParts},
    {id:'roman-bartos',length:'medium',name:'Roman Bartoš',role:'Designer',company:'Freelance',country:'Czechia',flag:'CZ',photo:'/media/guidance/coaching/roman-bartos.jpg',tags:['Transformational Coaching'],copy:romanReview},
    {id:'darja-arefjeva',length:'medium',name:'Darja Arefjeva',role:'Product Designer',company:'Pipedrive',country:'Russia',flag:'RU',photo:'/media/guidance/coaching/darja-arefjeva.jpg',tags:['Design Coaching'],copy:darjaReview},
    {id:'anastasiia-kozina',length:'short',name:'Anastasiia Kozina',role:'Founding Designer',company:'Illusian',country:'Finland',flag:'FI',photo:'/media/guidance/coaching/anastasiia-kozina.jpg',tags:['Life Coaching'],copy:anastasiiaReview},
    {id:'mako-ueda',length:'short',name:'Mako Ueda',role:'Business Operations Manager',company:'Career Break',country:'United States',flag:'US',photo:'/media/guidance/coaching/mako-ueda.jpg',tags:['Transformational Coaching'],copy:makoReview},
    {id:'ilja-panic',length:'medium',name:'Ilja Panić',role:'CTO & Co-Founder',company:'Resolve',country:'Czechia',flag:'CZ',photo:'/media/guidance/coaching/ilja-panic.jpg',tags:['Career Coaching'],copy:iljaReview},
    {id:'marie-lauren',length:'short',name:'Marie Lauren',role:'Community Representative',company:'Scott.Weber Workspace',country:'Czechia',flag:'CZ',photo:'/media/guidance/coaching/marie-lauren.jpg',tags:['Life Coaching'],copy:marieLaurenReview},
    {id:'tomas-lodnan',length:'medium',name:'Tomáš Lodňan',role:'CEO',company:'Good Request',country:'Slovakia',flag:'SK',photo:'/media/guidance/coaching/tomas-lodnan.jpg',tags:['Executive Coaching'],copy:tomasLodnanReview},
    {id:'kristyna-peckova',length:'medium',name:'Kristýna Pecková',role:'UX/UI Designer',company:'Freelance',country:'Czechia',flag:'CZ',photo:'/media/guidance/coaching/kristyna-peckova.jpg',tags:['Design Coaching'],copy:kristynaPeckovaReview},
    {id:'jakub-nespor',length:'short',name:'Jakub Nešpor',role:'Design Engineer',company:'Entire',country:'Czechia',flag:'CZ',photo:'/media/guidance/coaching/jakub-nespor.jpg',tags:['Transformational Coaching'],copy:jakubNesporReview},
    {id:'tomas-bruzda',length:'short',name:'Tomáš Bruzda',role:'Designer',company:'Freelance',country:'Czechia',flag:'CZ',photo:'/media/guidance/coaching/tomas-bruzda.jpg',tags:[],copy:tomasBruzdaReview},
    {id:'maros-novak',length:'big-single',name:'Maroš Novák',role:'Head of Design & Engineering',company:'GoodRequest',country:'Slovakia',flag:'SK',photo:'/media/guidance/coaching/maros-novak.jpg',tags:['Leadership Coaching'],copy:marosNovakReview}
  ];

  const mindsetNextEntry={id:'next-leadership',type:'next',name:'NEXT: Team Leadership →'};


  const leadershipEntries=[
    {id:'jan-pacek',name:'Jan Pacek',role:'Product Architect',company:'STRV',country:'Czechia',flag:'CZ',photo:'/media/guidance/leadership/jan-pacek.jpg',review:`When I think of leadership, two people immediately pop into my mind — Jocko Willink and Marian. Yes, Jocko is more badass and would probably kick both our asses, but I’ve had a chance to be part of Marian’s team for about two years, and his approach to leadership was always very inspiring. It’s the combination of absolute calmness in the face of everyday disasters together with strong values that bring new perspectives. After a conversation with Marian, every hopeless crisis has a light at the end of a tunnel, and you are left wondering why it was a disaster in the first place. Those two years made me a better person for sure.`},
    {id:'jan-kaltoun',name:'Jan Kaltoun',role:'Chief Operating Officer',company:'STRV',country:'Czechia',flag:'CZ',photo:'/media/guidance/leadership/jan-kaltoun.jpg',review:`Marian is one in a million kind of person, and working with him is simply a privilege. While Marian is not really a deeply technical person, he was able to successfully lead a team of leads who in turn led over a hundred designers and engineers. Working as a direct report to Marian, I was constantly amazed by how effortlessly he was able to tackle all the important tasks that needed to get done by empowering every single one of us in ways that are tough to put into words but endlessly effective. Marian listens, he brings the best out of you, he advises and, when needed, he pushes.`},
    {id:'petr-nohejl',name:'Petr Nohejl',role:'Engineering Manager',company:'STRV',country:'Czechia',flag:'CZ',photo:'/media/guidance/leadership/petr-nohejl.jpg',review:`The collaboration with Marian was very inspiring and definitely helped me move forward in my career as a leader. Marian was my lead and I worked closely with him for more than four years. What I appreciate most is that I could tell him anything, without filtering what I can or cannot say to my boss, and he always supported me and gave me good advice. He helped me overcome a number of crises. He made me think differently, from another perspective. Marian is a good listener and has a great talent for coaching. I am very happy I could be part of his team.`},
    {id:'jan-maly',name:'Jan Malý',role:'Founding AI Engineer',company:'Kontext',country:'Czechia',flag:'CZ',photo:'/media/guidance/leadership/jan-maly.jpg',review:`I was lucky to work under Marian’s supervision at STRV. He significantly impacted my career and development as he was highly supportive and acted as a coach, giving me space to grow. Thanks to Marian’s trust and guidance, we were able to start and grow the Data Science department.`},
    {id:'daniel-kraus',name:'Daniel Kraus',role:'Chief Technology Officer',company:'STRV',country:'Czechia',flag:'CZ',photo:'/media/guidance/leadership/daniel-kraus.jpg',review:`Everyone has in mind those very few people who at some point in their life left a substantial impact on their future. Those people are different from the crowd. Those people stand by their ideals no matter what. Those people you simply somehow know that you will always remember. This is Marian to me. I feel lucky I could have spent four years working closely under his leadership at STRV. He’s been an inspiring mentor. A manager who could support me fully but also was strict when needed.`},
    {id:'michal-klacko',name:'Michal Klačko',role:'Director of Engineering',company:'STRV',country:'Slovakia',flag:'SK',photo:'/media/guidance/leadership/michal-klacko.jpg',review:`Marian is a very unique person. He was my lead while I worked as the Lead of the Backend department at STRV. He was a lead you read about in books. He trusted his people, always left me and others space to grow, and helped or pushed when needed. Marian was always inclined toward coaching and dedicated a significant amount of time to learning it from professionals from QED. Having a “boss” and a coach in one person was unique, and I loved it. People at STRV noticed Marian’s talent for listening to people and helping them become better, or just to figure things out.`},
    {id:'juraj-kuliska',name:'Juraj Kuliška',role:'Senior Android Engineer',company:'Paylocity',country:'Slovakia',flag:'SK',photo:'/media/guidance/leadership/juraj-kuliska.jpg',review:`I had the honor to work with Marian for about two years. We had some really amazing talks that made me do great leaps in my career. Also, what I loved about Marian’s approach was that he always supported people in what they wanted to do most, even if it went against his own interests that he put aside — which is amazing both humanly and from a leadership point of view.`}
  ];

  const modes={
    mindset:{title:'Mindset<br>Coaching',kicker:'',intro:`I work with teams and individuals to find the version of you that isn't performing for anyone — the noise gone, just what's actually there. No immediate advice. No “do it like this.” Your style all the way — nothing forced.\n\nCertified ICF-ACSTH & EMCC, if credentials matter to you.`,order:['michal-bohac','roman-bartos','darja-arefjeva','anastasiia-kozina','mako-ueda','ilja-panic','marie-lauren','tomas-lodnan','kristyna-peckova','jakub-nespor','tomas-bruzda','maros-novak','next-leadership']},
    leadership:{title:'Team<br>Leadership',kicker:'',intro:'',order:leadershipEntries.map(entry=>entry.id)}
  };

  const partMarkup=entry=>`<div class="mf-guidance-copy-shell"><nav class="mf-guidance-review-parts" aria-label="Review parts">${entry.parts.map((_,index)=>`<button class="mf-guidance-part-button${index===0?' is-active':''}" type="button" data-review-part="${index}">PART ${String(index+1).padStart(2,'0')}</button>`).join('')}</nav><div class="mf-guidance-part-panels">${entry.parts.map((part,index)=>`<div class="mf-guidance-part-panel${index===0?' is-active':''}" data-review-part-panel="${index}"${index===0?'':' aria-hidden="true"'}>${nl(part)}</div>`).join('')}</div></div>`;
  const reviewMarkup=entry=>{
    if(entry.type==='next')return `<article class="mf-guidance-review is-guidance-next" id="guidance-review-${entry.id}" data-review-id="${entry.id}">${guidanceNextMarkup('Team Leadership →','leadership')}</article>`;
    const copy=entry.parts?partMarkup(entry):`<div class="mf-guidance-copy-shell"><div class="mf-guidance-single-copy">${nl(entry.copy)}</div></div>`;
    return `<article class="mf-guidance-review mf-guidance-review-universal${entry.parts?' has-parts':''}" id="guidance-review-${entry.id}" data-review-id="${entry.id}"><div class="mf-guidance-person-wrap">${personMarkup(entry)}</div><div class="mf-guidance-review-content">${tagsMarkup(entry)}${copy}</div></article>`;
  };


  const leadershipPeopleMarkup=()=>leadershipEntries.map((entry,index)=>`<button class="mf-leadership-person-card${index===0?' is-active':''}" type="button" data-leadership-person="${entry.id}" aria-label="Show review from ${escapeHtml(entry.name)}" aria-pressed="${index===0?'true':'false'}"><span class="mf-leadership-person-photo-wrap"><img src="${escapeHtml(entry.photo)}" alt="${escapeHtml(entry.name)}" loading="lazy" decoding="async"></span></button>`).join('');

  const leadershipContent=()=>`<div class="mf-leadership-page">
    <figure class="mf-leadership-hero-photo mf-guidance-scroll-reveal">
      <img src="/media/guidance/leadership/marian-fusek_chill.jpg" alt="Marian Fusek portrait" loading="eager" decoding="async" fetchpriority="high">
    </figure>
    <section class="mf-leadership-section" id="leadership-xp">
      <div class="mf-leadership-copy-block mf-guidance-scroll-reveal">
        <h3>XP – CHIEF DESIGN &amp; ENGINEERING OFFICER</h3>
        <p>My leadership experience comes mostly from my time at ${weightLinkMarkup('STRV','is-strv','https://www.strv.com')}. I led team leads and platform experts across iOS, Android, Backend, Frontend, Data Science, Design &amp; QA.</p>
        <div class="mf-leadership-stats"><div><small>LED</small><strong><span>11</span> <span>managers</span></strong></div><div><small>OVERSEEING</small><strong><span>130</span> <span>people</span></strong></div></div>
        <div class="mf-leadership-projects"><small>PROJECTS</small><p>Microsoft, Epic Games, The Athletic, Tinder, Autodesk, Barnes &amp; Noble, The Pump by Arnold Schwarzenegger, Barry's, and many more.</p></div>
        <h3 class="mf-leadership-secondary-xp">XP – DESIGN TEAM LEAD*</h3>
        <p>Before that, I ran STRV’s Design Team — and for a bit, when QA had no lead, ran both teams at once. Good times.</p>
        <p class="mf-leadership-eleken-link">${weightLinkMarkup('My take on leadership in Eleken interview','is-eleken','https://www.eleken.co/blog-posts/managing-a-design-team-interview-with-seasoned-design-leaders')}</p>
      </div>
      <div class="mf-leadership-copy-block mf-guidance-scroll-reveal">
        <h3>UPTIME</h3>
        <p>I’m at my best when things are still being established — early-stage, lots of heavy lifting, real progress. That’s also where my coaching background kicks in — I’m good at navigating chaos and clearing the air. Once everything’s clicking, stagnation creeps in, and everyone’s obsessing over optimizing 91% into 92%, I’m ready for a shift.</p>
      </div>
      <div class="mf-leadership-copy-block mf-guidance-scroll-reveal">
        <h3>HIGHLIGHTS</h3>
        <ul>
          <li>Started the company’s first regular performance reviews — later adopted company-wide</li>
          <li>Built the first career ladder for designers — later adopted by other D&amp;E departments</li>
          <li>Co-ran the first company academy for new talent in D&amp;E</li>
          <li>Mentored the first company academy track for designers</li>
          <li>Listen, stuff was happening and I was around, so…</li>
        </ul>
      </div>
      <figure class="mf-leadership-graduates-photo mf-guidance-scroll-reveal">
        <img src="/media/guidance/leadership/academy-designers.jpg" alt="Academy designers" loading="lazy">
        <figcaption>MY FIRST DESIGN GRADUATES</figcaption>
      </figure>
      <div class="mf-leadership-copy-block mf-leadership-reviews-intro mf-guidance-scroll-reveal">
        <h3>REVIEWS</h3>
        <p>Kind words (no cash transaction involved) from some of my former team members.</p>
      </div>
    </section>
    <section class="mf-leadership-section" id="leadership-reviews">
      <div class="mf-leadership-people-strip mf-guidance-scroll-reveal" aria-label="Team review carousel">${leadershipPeopleMarkup()}</div>
      <div class="mf-leadership-review-detail mf-guidance-scroll-reveal" id="mfLeadershipReviewDetail"></div>
    </section>
    <section class="mf-leadership-section" id="leadership-next">
      <div class="mf-leadership-copy-block mf-guidance-scroll-reveal">
        <h3>NEXT?</h3>
        <p>If you’ve got a team out there and need support — hit me up. I treat leadership with the utmost respect. It’s sensitive territory, so job descriptions go aside here. Just tell me what’s going on, and we’ll figure it out from there.</p>
        <p>Design, coaching, leadership — whatever the label, if something I do feels relevant to what you need, that’s enough reason to reach out. We’ll cook up the collab that actually fits, together. [hits the table]</p>
        <button class="mf-art-cta mf-leadership-cta" type="button" id="mfLeadershipCopyButton">Well said MF!</button>
      </div>
      <div class="mf-leadership-guidance-next mf-guidance-scroll-reveal">${guidanceNextMarkup('Mindset Coaching →','mindset')}</div>
    </section>
  </div>`;


  const leadershipDetailMarkup=entry=>`<article class="mf-leadership-review-expanded"><header class="mf-leadership-review-head"><h4>${escapeHtml(entry.name)}</h4><div class="mf-leadership-review-meta"><span>${escapeHtml(entry.role)}</span><span>${escapeHtml(entry.company)}</span></div></header><div class="mf-leadership-review-body"><p>${escapeHtml(entry.review)}</p></div></article>`;

  let currentMode='mindset';
  let guidanceReturnY=0;
  let activeReviewId='';
  let reviewScrollFrame=0;
  let guidanceObserver=null;
  let snapTimer=0;
  let asciiTimer=0;
  const mobileGuidance=window.matchMedia('(max-width:1024px)');

  let leadershipTargetScroll=0;
  let leadershipScrollFrame=0;
  let modeSwitching=false;

  function stopLeadershipScroll(){
    cancelAnimationFrame(leadershipScrollFrame);
    leadershipScrollFrame=0;
  }
  function runLeadershipScroll(){
    const max=Math.max(0,reviewsHost.scrollHeight-reviewsHost.clientHeight);
    leadershipTargetScroll=Math.max(0,Math.min(max,leadershipTargetScroll));
    const distance=leadershipTargetScroll-reviewsHost.scrollTop;
    reviewsHost.scrollTop+=distance*.18;
    if(Math.abs(distance)>.35){leadershipScrollFrame=requestAnimationFrame(runLeadershipScroll);return;}
    reviewsHost.scrollTop=leadershipTargetScroll;
    leadershipScrollFrame=0;
  }


  function setupGuidanceReveals(){
    guidanceObserver?.disconnect();
    const root=mobileGuidance.matches?overlay:reviewsHost;
    const targets=[...reviewsHost.querySelectorAll('.mf-guidance-review, .mf-guidance-scroll-reveal, .mf-guidance-next-link')];
    if(!targets.length)return;
    guidanceObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        const rootBounds=entry.rootBounds||{top:0,height:innerHeight};
        const isNext=entry.target.classList.contains('mf-guidance-next-link');
        const visible=isNext
          ?entry.isIntersecting&&entry.boundingClientRect.top<=rootBounds.top+rootBounds.height*.52&&entry.boundingClientRect.bottom>rootBounds.top
          :entry.isIntersecting&&entry.intersectionRatio>=.12;
        entry.target.classList.toggle('is-in-view',visible);
      });
    },{root,rootMargin:'-4% 0px -7% 0px',threshold:[0,.12,.32,.58]});
    targets.forEach((target,index)=>{
      target.style.setProperty('--guide-delay',`${Math.min(index,6)*34}ms`);
      guidanceObserver.observe(target);
    });
  }


  let snapInFlight=false;
  let snapAnimationFrame=0;
  let mindsetWheelTotal=0;
  let mindsetWheelReset=0;
  const easeInOutCubic=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const getDominantMindsetReview=()=>{
    const articles=[...reviewsHost.querySelectorAll('[data-review-id]')];
    if(!articles.length)return null;
    const viewportTop=reviewsHost.scrollTop;
    const viewportBottom=viewportTop+reviewsHost.clientHeight;
    let best=articles[0],bestVisible=-1,bestCenter=Infinity;
    articles.forEach(article=>{
      const top=article.offsetTop;
      const bottom=top+article.offsetHeight;
      const visible=Math.max(0,Math.min(bottom,viewportBottom)-Math.max(top,viewportTop));
      const centerDistance=Math.abs((top+bottom)/2-(viewportTop+viewportBottom)/2);
      if(visible>bestVisible+1||(Math.abs(visible-bestVisible)<=1&&centerDistance<bestCenter)){
        best=article;bestVisible=visible;bestCenter=centerDistance;
      }
    });
    return best;
  };
  function animateGuidanceScroll(destination,duration=760){
    cancelAnimationFrame(snapAnimationFrame);
    const start=reviewsHost.scrollTop;
    const distance=destination-start;
    if(Math.abs(distance)<2){
      reviewsHost.scrollTop=destination;
      snapInFlight=false;
      const target=getDominantMindsetReview();
      if(target)markActiveReview(target.dataset.reviewId);
      return;
    }
    snapInFlight=true;
    const started=performance.now();
    const frame=now=>{
      const progress=Math.min(1,(now-started)/duration);
      reviewsHost.scrollTop=start+distance*easeInOutCubic(progress);
      if(progress<1){snapAnimationFrame=requestAnimationFrame(frame);return;}
      reviewsHost.scrollTop=destination;
      snapInFlight=false;
      const target=getDominantMindsetReview();
      if(target)markActiveReview(target.dataset.reviewId);
    };
    snapAnimationFrame=requestAnimationFrame(frame);
  }
  function scrollToMindsetReview(next){
    const articles=[...reviewsHost.querySelectorAll('[data-review-id]')];
    if(!articles.length||snapInFlight)return;
    next=Math.max(0,Math.min(articles.length-1,next));
    const currentIndex=Math.max(0,articles.findIndex(article=>article.dataset.reviewId===activeReviewId));
    if(next===currentIndex)return;
    clearTimeout(snapTimer);
    mindsetWheelTotal=0;
    animateGuidanceScroll(articles[next].offsetTop,760);
  }
  function settleMindsetReview(){
    if(currentMode!=='mindset'||mobileGuidance.matches||!overlay.classList.contains('is-open')||snapInFlight)return;
    const target=getDominantMindsetReview();
    if(!target)return;
    markActiveReview(target.dataset.reviewId);
    animateGuidanceScroll(target.offsetTop,760);
  }
  function queueMindsetSettle(){
    if(currentMode!=='mindset'||mobileGuidance.matches||snapInFlight)return;
    clearTimeout(snapTimer);
    snapTimer=setTimeout(settleMindsetReview,150);
  }

  function stopGuidanceAscii(){
    clearInterval(asciiTimer);
    asciiTimer=0;
    overlay.querySelectorAll('.mf-guidance-ascii').forEach(node=>node.remove());
  }
  function startGuidanceAscii(){
    stopGuidanceAscii();
    if(currentMode!=='leadership')return;
    const glyphs=['+ +','001101','// MF','[LEAD]','<>_','0xFF',':::','* * *'];
    asciiTimer=setInterval(()=>{
      if(!overlay.classList.contains('is-open')||document.hidden)return;
      const host=reviewsHost.querySelector('.mf-leadership-page');
      if(!host)return;
      const node=document.createElement('span');
      node.className='mf-guidance-ascii';
      node.textContent=glyphs[Math.floor(Math.random()*glyphs.length)];
      node.style.left=`${8+Math.random()*84}%`;
      node.style.top=`${Math.max(12,Math.min(92,((reviewsHost.scrollTop+Math.random()*reviewsHost.clientHeight)/Math.max(1,host.scrollHeight))*100))}%`;
      host.appendChild(node);
      requestAnimationFrame(()=>node.classList.add('is-visible'));
      setTimeout(()=>node.remove(),950);
    },2300);
  }

  const markActiveReview=id=>{
    if(!id||id===activeReviewId)return;
    activeReviewId=id;
    reviewNav.querySelectorAll('[data-review-target]').forEach(button=>{
      const active=button.dataset.reviewTarget===id;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-current',active?'true':'false');
    });
  };
  const updateActiveReview=()=>{
    reviewScrollFrame=0;
    if(currentMode!=='mindset')return;
    const dominant=getDominantMindsetReview();
    if(dominant)markActiveReview(dominant.dataset.reviewId);
  };
  const scheduleReviewTracking=()=>{ if(!reviewScrollFrame)reviewScrollFrame=requestAnimationFrame(updateActiveReview); };
  const supportsScrollEnd='onscrollend' in reviewsHost;
  reviewsHost.addEventListener('scroll',()=>{
    scheduleReviewTracking();
    if(!supportsScrollEnd)queueMindsetSettle();
  },{passive:true});
  if(supportsScrollEnd)reviewsHost.addEventListener('scrollend',settleMindsetReview,{passive:true});
  reviewsHost.addEventListener('wheel',event=>{
    if(currentMode!=='mindset'||mobileGuidance.matches||!overlay.classList.contains('is-open'))return;
    event.preventDefault();
    if(snapInFlight)return;
    mindsetWheelTotal+=event.deltaY;
    clearTimeout(mindsetWheelReset);
    mindsetWheelReset=setTimeout(()=>{mindsetWheelTotal=0;},140);
    if(Math.abs(mindsetWheelTotal)<34)return;
    const articles=[...reviewsHost.querySelectorAll('[data-review-id]')];
    if(!articles.length)return;
    const activeIndex=articles.findIndex(article=>article.dataset.reviewId===activeReviewId);
    const currentIndex=activeIndex>=0?activeIndex:Math.max(0,articles.indexOf(getDominantMindsetReview()));
    const direction=mindsetWheelTotal>0?1:-1;
    mindsetWheelTotal=0;
    scrollToMindsetReview(currentIndex+direction);
  },{passive:false});
  overlay.addEventListener('scroll',scheduleReviewTracking,{passive:true});

  function bindReviewParts(){
    reviewsHost.querySelectorAll('.mf-guidance-copy-shell').forEach(shell=>{
      const buttons=[...shell.querySelectorAll('[data-review-part]')];
      const panels=[...shell.querySelectorAll('[data-review-part-panel]')];
      if(buttons.length<2||panels.length<2)return;
      let active=0,switching=false;
      buttons.forEach(button=>button.addEventListener('click',()=>{
        const next=Number(button.dataset.reviewPart);
        if(switching||next===active||!panels[next])return;
        switching=true;
        panels[active].classList.add('is-leaving');
        setTimeout(()=>{
          panels[active].classList.remove('is-active','is-leaving');
          panels[active].setAttribute('aria-hidden','true');
          panels[next].classList.add('is-active','is-entering');
          panels[next].setAttribute('aria-hidden','false');
          buttons.forEach((item,index)=>item.classList.toggle('is-active',index===next));
          requestAnimationFrame(()=>requestAnimationFrame(()=>panels[next].classList.remove('is-entering')));
          active=next;
          setTimeout(()=>{switching=false;},220);
        },130);
      }));
    });
  }

  function bindMindset(){
    bindReviewParts();
    reviewNav.querySelectorAll('[data-review-target]').forEach(button=>button.addEventListener('click',()=>{
      const target=document.getElementById(`guidance-review-${button.dataset.reviewTarget}`);
      if(!target)return;
      markActiveReview(button.dataset.reviewTarget);
      animateGuidanceScroll(target.offsetTop,760);
    }));
  }

  function bindLeadership(){
    const detail=reviewsHost.querySelector('#mfLeadershipReviewDetail');
    const strip=reviewsHost.querySelector('.mf-leadership-people-strip');
    if(!detail||!strip)return;

    const paint=(id,animate=true)=>{
      const entry=leadershipEntries.find(item=>item.id===id)||leadershipEntries[0];
      if(!entry)return;
      const cards=[...strip.querySelectorAll('[data-leadership-person]')];
      const clicked=cards.find(card=>card.dataset.leadershipPerson===entry.id);
      if(!clicked)return;

      const firstRects=new Map(cards.map(card=>[card,card.getBoundingClientRect()]));
      while(strip.firstElementChild!==clicked)strip.appendChild(strip.firstElementChild);
      const reordered=[...strip.querySelectorAll('[data-leadership-person]')];
      const lastRects=new Map(reordered.map(card=>[card,card.getBoundingClientRect()]));
      reordered.forEach(card=>{
        const first=firstRects.get(card),last=lastRects.get(card);
        if(!first||!last)return;
        card.style.transition='none';
        card.style.transform=`translate3d(${first.left-last.left}px,${first.top-last.top}px,0)`;
      });
      strip.offsetHeight;
      reordered.forEach(card=>{
        card.style.transition='transform .78s cubic-bezier(.16,1,.3,1), opacity .48s cubic-bezier(.16,1,.3,1), flex-basis .72s cubic-bezier(.16,1,.3,1), width .72s cubic-bezier(.16,1,.3,1)';
        card.style.transform='translate3d(0,0,0)';
        const active=card===clicked;
        card.classList.toggle('is-active',active);
        card.setAttribute('aria-pressed',active?'true':'false');
      });
      strip.scrollTo({left:0,behavior:'smooth'});

      const swap=()=>{
        detail.innerHTML=leadershipDetailMarkup(entry);
        const panel=detail.querySelector('.mf-leadership-review-expanded');
        requestAnimationFrame(()=>requestAnimationFrame(()=>{panel?.classList.add('is-visible');}));
      };
      if(!animate){swap();return;}
      detail.classList.add('is-switching');
      setTimeout(()=>{swap();detail.classList.remove('is-switching');},150);
    };

    strip.addEventListener('click',event=>{
      const card=event.target.closest('[data-leadership-person]');
      if(card)paint(card.dataset.leadershipPerson,true);
    });
    const first=strip.querySelector('[data-leadership-person]');
    if(first)paint(first.dataset.leadershipPerson,false);

    const copyBtn=reviewsHost.querySelector('#mfLeadershipCopyButton');
    copyBtn?.addEventListener('click',async()=>{
      const email='email@marianfusek.com';
      let copied=false;
      try{
        await navigator.clipboard.writeText(email);
        copied=true;
      }catch(_){
        const helper=document.createElement('textarea');
        helper.value=email;
        helper.setAttribute('readonly','');
        helper.style.position='fixed';
        helper.style.opacity='0';
        document.body.appendChild(helper);
        helper.select();
        try{ copied=document.execCommand('copy'); }catch(__){ copied=false; }
        helper.remove();
      }
      copyBtn.textContent=copied?'Email copied to your clipboard .)':'Copy email@marianfusek.com';
    });
  }

  function render(mode){
    currentMode=mode in modes?mode:'mindset';
    overlay.classList.toggle('is-leadership',currentMode==='leadership');
    overlay.classList.toggle('is-mindset',currentMode==='mindset');
    const config=modes[currentMode];
    overlayTitle.innerHTML=config.title;
    kicker.textContent="";
    overlayIntro.textContent=config.intro;
    reviewsHost.scrollTop=0;
    overlay.scrollTop=0;
    activeReviewId='';
    mindsetWheelTotal=0;
    clearTimeout(mindsetWheelReset);

    if(currentMode==='mindset'){
      const ordered=config.order.map(id=>id===mindsetNextEntry.id?mindsetNextEntry:mindsetEntries.find(entry=>entry.id===id)).filter(Boolean);
      reviewNav.innerHTML=ordered.map((entry,index)=>entry.type==='next'
        ?`<button class="is-guidance-next-nav" type="button" data-review-target="${entry.id}"><span>${String(index+1).padStart(2,'0')}</span><span>NEXT: Team Leadership →</span><span></span></button>`
        :`<button type="button" data-review-target="${entry.id}"><span>${String(index+1).padStart(2,'0')}</span><span>${escapeHtml(entry.name)}</span><span>${flagMarkup(entry.flag)}</span></button>`).join('');
      reviewsHost.innerHTML=ordered.map(reviewMarkup).join('');
      bindMindset();
      markActiveReview(ordered[0]?.id);
      scheduleReviewTracking();
      requestAnimationFrame(()=>{setupGuidanceReveals();});
      return;
    }

    reviewNav.innerHTML='';
    reviewsHost.innerHTML=leadershipContent();
    leadershipTargetScroll=0;
    bindLeadership();
    requestAnimationFrame(()=>{
      setupGuidanceReveals();
      
      startGuidanceAscii();
    });
  }

  async function transitionGuidanceMode(mode){
    if(modeSwitching||mode===currentMode)return;
    modeSwitching=true;
    stopLeadershipScroll();
    overlay.classList.add('is-mode-switching');
    await wait(330);
    render(mode);
    overlay.classList.remove('is-mode-switching');
    overlay.classList.add('is-mode-entering');
    requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.remove('is-mode-entering')));
    setTimeout(()=>{modeSwitching=false;},620);
  }

  function open(mode){
    guidanceReturnY=window.scrollY+guidanceSection.getBoundingClientRect().top;
    render(mode);
    overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('mf-guidance-open');
    overlay.classList.add('is-entering');
    requestAnimationFrame(()=>overlay.classList.add('is-open'));
    setTimeout(()=>overlay.classList.remove('is-entering'),1150);
    setTimeout(()=>reviewsHost.focus({preventScroll:true}),360);
  }
  function close(){
    stopGuidanceAscii();
    stopLeadershipScroll();
    guidanceObserver?.disconnect();
    overlay.classList.remove('is-open','is-entering');
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('mf-guidance-open');
    requestAnimationFrame(()=>window.scrollTo({top:guidanceReturnY,behavior:'auto'}));
  }

  reviewsHost.addEventListener('click',event=>{
    const next=event.target.closest('[data-guidance-next]');
    if(next)transitionGuidanceMode(next.dataset.guidanceNext);
  });
  reviewsHost.addEventListener('wheel',event=>{
    if(currentMode!=='leadership'||mobileGuidance.matches||!overlay.classList.contains('is-open'))return;
    event.preventDefault();
    const max=Math.max(0,reviewsHost.scrollHeight-reviewsHost.clientHeight);
    const normalized=event.deltaMode===1?event.deltaY*16:event.deltaMode===2?event.deltaY*reviewsHost.clientHeight:event.deltaY;
    if(!leadershipScrollFrame)leadershipTargetScroll=reviewsHost.scrollTop;
    leadershipTargetScroll=Math.max(0,Math.min(max,leadershipTargetScroll+normalized));
    if(!leadershipScrollFrame)leadershipScrollFrame=requestAnimationFrame(runLeadershipScroll);
  },{passive:false});

  document.querySelectorAll('[data-guidance]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.guidance)));
  closeButton.addEventListener('click',close);
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&overlay.classList.contains('is-open'))close();});
})();

/* BIO TABS — slower sequential fade, stable on desktop and mobile */
(function(){
  const menu=document.querySelector('.mf-bio-menu');
  const wrapper=document.getElementById('mfBioPanels');
  if(!menu||!wrapper)return;

  const buttons=[...menu.querySelectorAll('[data-bio-tab]')];
  const panels=[...wrapper.querySelectorAll('[data-bio-panel]')];
  let active=wrapper.querySelector('.mf-bio-panel.is-active')||panels[0];
  let switching=false;

  panels.forEach(panel=>{
    const selected=panel===active;
    panel.setAttribute('aria-hidden',selected?'false':'true');
    panel.inert=!selected;
  });

  function setMenu(key){
    buttons.forEach(button=>{
      const selected=button.dataset.bioTab===key;
      button.classList.toggle('is-active',selected);
      button.setAttribute('aria-selected',selected?'true':'false');
    });
  }

  const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

  async function showPanel(key){
    const next=wrapper.querySelector(`[data-bio-panel="${key}"]`);
    if(!next||next===active||switching)return;

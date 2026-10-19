import { inquiryContext, prepareInquiry } from './data/inquiry.js';

// Resolve runtime media relative to this deployment, including GitHub project Pages.
const siteRoot = new URL('../', import.meta.url);
const assetUrl = value => new URL(value.replace(/^\//, ''), siteRoot).href;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#primary-nav');
const closeSubmenus = () => document.querySelectorAll('.nav-item.open').forEach(item => {
  item.classList.remove('open');
  item.querySelector('button')?.setAttribute('aria-expanded', 'false');
});
const closeMenu = () => { nav.classList.remove('open'); menuToggle.setAttribute('aria-expanded', 'false'); closeSubmenus(); };
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('open', open);
});
document.querySelectorAll('.submenu-toggle').forEach(button => button.addEventListener('click', () => {
  const open = button.getAttribute('aria-expanded') !== 'true';
  closeSubmenus();
  button.setAttribute('aria-expanded', String(open));
  button.closest('.nav-item').classList.toggle('open', open);
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    const activeSubmenu = document.querySelector('.nav-item.open .submenu-toggle');
    if (activeSubmenu) { closeSubmenus(); activeSubmenu.focus(); }
    else if (nav.classList.contains('open')) { closeMenu(); menuToggle.focus(); }
  }
});
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
document.querySelector('.site-header').addEventListener('focusout', event => {
  if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) closeMenu();
});
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
const mobileNavigation = window.matchMedia('(max-width: 1100px)');
mobileNavigation.addEventListener('change', closeMenu);

// Supplied product images are rendered in HTML so they load without JavaScript.
document.querySelectorAll('[data-static-image]').forEach(frame => {
  const img = frame.querySelector('img');
  const onError = () => {
    img.hidden = true;
    frame.classList.remove('media-loaded');
    frame.querySelector('.supplied-caption').hidden = false;
  };
  img.addEventListener('error', onError);
  if (img.complete && !img.naturalWidth) onError();
});

// Supplied videos play on view; demonstrations with controls also preserve manual pause.
const suppliedVideos = [...document.querySelectorAll('[data-native-video] video')];
if (suppliedVideos.length) {
  const states = new Map(suppliedVideos.map(video => [video, { visible:false, userPaused:false, automaticPause:false }]));
  const syncVideo = video => {
    const state = states.get(video);
    if (!state.visible || document.hidden) {
      if (!video.paused) { state.automaticPause = true; video.pause(); }
    } else if (video.hasAttribute('data-autoplay-on-view') && !state.userPaused && !reduceMotion.matches && !navigator.connection?.saveData) {
      video.play().catch(() => {});
    }
  };
  const visibilityObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    states.get(entry.target).visible = entry.isIntersecting && entry.intersectionRatio >= .25;
    syncVideo(entry.target);
  }), { threshold: [0,.25] });
  suppliedVideos.forEach(video => {
    video.addEventListener('pause', () => {
      const state = states.get(video);
      if (!state.automaticPause && state.visible && !document.hidden) state.userPaused = true;
      state.automaticPause = false;
    });
    video.addEventListener('play', () => { states.get(video).userPaused = false; });
    visibilityObserver.observe(video);
  });
  document.addEventListener('visibilitychange', () => suppliedVideos.forEach(syncVideo));
  reduceMotion.addEventListener('change', () => {
    suppliedVideos.forEach(video => {
      if (reduceMotion.matches && !video.paused) { states.get(video).automaticPause = true; video.pause(); }
      else syncVideo(video);
    });
  });
}

// Only manifest-listed pending media is requested. Missing media keeps its art-directed fallback.
async function activateMedia() {
  const response = await fetch(new URL('media/manifest.json', siteRoot));
  if (!response.ok) return;
  const manifest = new Set(await response.json());
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  const autoplayAllowed = () => !reduceMotion.matches && !navigator.connection?.saveData;
  const activeVideos = new Set();
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    const frame = entry.target;
    if (!entry.isIntersecting) {
      const video = frame.querySelector('video');
      if (video) { video.pause(); activeVideos.delete(video); }
      return;
    }
    if (frame.dataset.activated) {
      const video = frame.querySelector('video');
      const config = JSON.parse(frame.dataset.config);
      if (video && config.decorative && autoplayAllowed() && !video.dataset.userPaused) {
        activeVideos.add(video); video.play().catch(() => {});
      }
      return;
    }
    frame.dataset.activated = 'true';
    const item = JSON.parse(frame.dataset.config);
    const src = mobile && manifest.has(item.mobileSrc) ? item.mobileSrc : item.src;
    const poster = mobile && manifest.has(item.mobilePoster) ? item.mobilePoster : item.poster;
    const mount = frame.querySelector('.media-mount');
    const showFallback = () => { mount.replaceChildren(); frame.classList.remove('media-loaded'); frame.querySelector('.video-control')?.setAttribute('hidden', ''); };
    const addPoster = () => {
      if (!manifest.has(poster)) return;
      const img = new Image(); img.alt = item.alt || item.label; img.decoding = 'async';
      img.onload = () => frame.classList.add('media-loaded'); img.onerror = showFallback;
      img.src = assetUrl(poster); mount.append(img);
    };
    if (!manifest.has(src)) { if (item.kind === 'video') addPoster(); return; }
    if (item.kind === 'image') {
      const img = new Image(); img.alt = item.alt || item.label; img.decoding = 'async';
      img.onload = () => frame.classList.add('media-loaded'); img.onerror = showFallback; img.src = assetUrl(src); mount.append(img);
      return;
    }
    const video = document.createElement('video');
    video.playsInline = true; video.preload = 'none'; video.loop = Boolean(item.decorative); video.muted = Boolean(item.decorative);
    video.setAttribute('aria-label', item.label);
    if (manifest.has(poster)) { video.poster = assetUrl(poster); frame.classList.add('media-loaded'); }
    video.addEventListener('error', showFallback);
    video.addEventListener('loadeddata', () => frame.classList.add('media-loaded'));
    video.src = assetUrl(src); mount.append(video);
    if (item.captions && manifest.has(item.captions)) {
      const track = document.createElement('track'); track.kind = 'captions'; track.src = assetUrl(item.captions);
      track.srclang = item.captionLanguage || 'en'; track.label = item.captionLabel || 'English'; track.default = true;
      video.append(track);
    }
    const control = frame.querySelector('.video-control'); control.hidden = false;
    const updateControl = () => { control.setAttribute('aria-label', `${video.paused ? 'Play' : 'Pause'} ${item.label} video`); control.innerHTML = `<span aria-hidden="true">${video.paused ? '▶' : 'Ⅱ'}</span><span>${video.paused ? 'PLAY' : 'PAUSE'}</span>`; };
    video.addEventListener('play', updateControl); video.addEventListener('pause', updateControl); updateControl();
    control.addEventListener('click', () => {
      if (video.paused) { delete video.dataset.userPaused; video.controls = !item.decorative; activeVideos.add(video); video.play().catch(() => {}); }
      else { video.dataset.userPaused = 'true'; video.pause(); activeVideos.delete(video); }
    });
    if (item.decorative && autoplayAllowed()) { activeVideos.add(video); video.play().catch(() => {}); }
  }), { threshold: 0.15 });
  document.querySelectorAll('[data-media]:not([data-static-image])').forEach(frame => observer.observe(frame));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { activeVideos.forEach(video => video.pause()); activeVideos.clear(); } });
  reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) { activeVideos.forEach(video => video.pause()); activeVideos.clear(); } });
}
activateMedia().catch(() => {});

const search = document.querySelector('#news-search');
if (search) {
  let category = 'All';
  const applyFilter = () => {
    let count = 0;
    document.querySelectorAll('.news-card').forEach(card => {
      const visible = (category === 'All' || card.dataset.category === category) && card.dataset.search.includes(search.value.trim().toLowerCase());
      card.hidden = !visible; card.classList.add('visible'); if (visible) count++;
    });
    document.querySelector('#news-result-count').textContent = `${count} ${count === 1 ? 'UPDATE' : 'UPDATES'}`;
    document.querySelector('.empty-results').hidden = count > 0;
  };
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    category = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    applyFilter();
  }));
  search.addEventListener('input', applyFilter);
}

const form = document.querySelector('#contact-form');
if (form) {
  const context = inquiryContext(location.search);
  const status = document.querySelector('#contact-status');
  const draft = document.querySelector('#email-draft');
  const output = document.querySelector('.email-fallback');
  const openMail = document.querySelector('#open-mail');
  const copyButton = document.querySelector('#copy-draft');
  form.elements.interest.value = context.interest;
  if (context.detail) form.elements.message.value = `I’d like information about ${context.detail}.`;
  if (context.briefing) document.querySelector('#inquiry-purpose').textContent = 'REQUEST A CAPABILITY BRIEFING';
  document.querySelector('#inquiry-fields').disabled = false;
  document.querySelector('#prepare-draft').disabled = false;
  form.addEventListener('invalid', () => { status.textContent = 'Please complete the required fields and enter a valid work email.'; }, true);
  const clearDraft = () => {
    const hadDraft = !output.hidden;
    draft.value = '';
    openMail.removeAttribute('href');
    output.hidden = true;
    status.textContent = hadDraft ? 'Details changed. Prepare a new draft before sending.' : '';
  };
  form.addEventListener('input', event => {
    if (event.target === draft) return;
    event.target.setCustomValidity?.('');
    clearDraft();
  });
  form.addEventListener('reset', clearDraft);
  form.addEventListener('submit', event => {
    event.preventDefault();
    for (const name of ['name', 'organization']) {
      form.elements[name].setCustomValidity(form.elements[name].value.trim() ? '' : 'Please complete this field.');
    }
    if (!form.reportValidity()) return;
    try {
      const prepared = prepareInquiry(new FormData(form), { email: form.dataset.email, trainingEmail: form.dataset.trainingEmail }, context.briefing);
      draft.value = prepared.text;
      openMail.href = prepared.mailto;
      openMail.hidden = prepared.mailto.length > 1900;
      output.hidden = false;
      status.textContent = openMail.hidden
        ? 'Draft prepared. Copy the full draft into your email application; this draft is too long for a reliable email link. Your inquiry has not been sent.'
        : 'Draft prepared. Open your email application or copy the draft below. Your inquiry has not been sent.';
    } catch {
      clearDraft();
      status.textContent = 'The draft could not be prepared. Please check your entries or contact T3i using the email or phone links.';
    }
  });
  copyButton.addEventListener('click', async () => {
    copyButton.disabled = true;
    copyButton.textContent = 'Copying…';
    try { await navigator.clipboard.writeText(draft.value); status.textContent = 'Email draft copied. Paste it into your email application to review and send. Your inquiry has not been sent.'; }
    catch { draft.focus(); draft.select(); status.textContent = 'Automatic copying is unavailable. Select and copy the draft using your keyboard. Your inquiry has not been sent.'; }
    finally { copyButton.disabled = false; copyButton.textContent = 'Copy Draft'; }
  });
}

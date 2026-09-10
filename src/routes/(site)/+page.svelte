<script lang="ts">
	import { getLocale, localizeHref } from '#lib/paraglide/runtime';
	import { listOpinions } from '#lib/remote/site.remote';
	import OpinionsCarousel from '#lib/components/OpinionsCarousel.svelte';
	import * as m from '#lib/paraglide/messages';

	const opinions = await listOpinions(getLocale());

	// Static marketing copy lives in the message catalogue rather than the
	// database - it is part of the page's design, not content the school edits
	// day to day.
	const stats = [
		{ value: m.stat_pass_rate_value(), label: m.stat_pass_rate_label() },
		{ value: m.stat_years_value(), label: m.stat_years_label() },
		{ value: m.stat_graduates_value(), label: m.stat_graduates_label() }
	];

	const features = [
		{ icon: '🏆', title: m.feature_pass_rate_title(), body: m.feature_pass_rate_body() },
		{ icon: '👨‍🏫', title: m.feature_instructors_title(), body: m.feature_instructors_body() },
		{ icon: '📱', title: m.feature_theory_title(), body: m.feature_theory_body() },
		{ icon: '🚗', title: m.feature_fleet_title(), body: m.feature_fleet_body() },
		{ icon: '📅', title: m.feature_hours_title(), body: m.feature_hours_body() },
		{ icon: '💳', title: m.feature_payments_title(), body: m.feature_payments_body() }
	];
</script>

<svelte:head>
	<title>{m.home_title()}</title>
	<meta name="description" content={m.site_description()} />
</svelte:head>

<!-- Hero -------------------------------------------------------------------->
<section class="relative overflow-hidden bg-navy px-6 pt-20 pb-16 text-center">
	<img
		src="/hero.png"
		alt=""
		aria-hidden="true"
		fetchpriority="high"
		class="absolute inset-0 h-full w-full object-cover object-[center_55%]"
	/>
	<div
		class="absolute inset-0 bg-[linear-gradient(rgba(0,22,51,0.82)_0%,rgba(0,22,51,0.75)_60%,rgba(0,22,51,0.92)_100%)]"
	></div>
	<div
		class="absolute inset-x-0 top-0 h-2 bg-[linear-gradient(to_right,#D62828_33%,#F5EB18_33%,#F5EB18_66%,#F77F00_66%)]"
	></div>

	<div class="relative mx-auto max-w-[820px]">
		<p
			class="mb-6 inline-block bg-red px-4 py-[0.35rem] text-[0.8rem] font-bold tracking-[0.15em] text-paper uppercase"
		>
			{m.hero_badge()}
		</p>

		<h1 class="mb-5 text-[clamp(2.4rem,6vw,4.2rem)] leading-[1.1] font-bold text-paper">
			{m.hero_title_line1()}<br />
			<span class="text-yellow">{m.hero_title_line2()}</span><br />
			{m.hero_title_line3()}
		</h1>

		<p class="mx-auto mb-10 max-w-[620px] text-[1.15rem] leading-[1.7] text-paper/82">
			{m.hero_lead_before()}<strong class="text-yellow">{m.hero_lead_highlight()}</strong
			>{m.hero_lead_after()}
		</p>

		<div class="flex flex-wrap justify-center gap-4">
			<a href={localizeHref('/kontakt')} class="btn btn-red">{m.hero_cta_primary()}</a>
			<a href={localizeHref('/instruktorzy')} class="btn btn-ghost">{m.hero_cta_secondary()}</a>
		</div>
	</div>

	<!-- Three across is the design, but three tiles cannot hold their content on a
	     320-375px screen, so they stack until there is room. Not `auto-fit`: a row
	     of two would leave an empty cell showing the wrapper's hairline colour. -->
	<div
		class="relative mx-auto mt-16 grid max-w-300 grid-cols-1 gap-px border border-white/12 bg-white/12 sm:grid-cols-3"
	>
		{#each stats as stat (stat.label)}
			<div class="bg-blue/40 px-4 py-7 text-center">
				<div class="font-display text-[clamp(2rem,4vw,2.8rem)] leading-none font-bold text-yellow">
					{stat.value}
				</div>
				<div class="mt-[0.4rem] text-[0.85rem] tracking-widest text-paper/70 uppercase">
					{stat.label}
				</div>
			</div>
		{/each}
	</div>
</section>

<!-- Why us ------------------------------------------------------------------>
<section class="bg-paper px-6 py-20 text-navy">
	<div class="mx-auto max-w-[1100px]">
		<div class="mb-12">
			<div class="section-rule bg-red"></div>
			<h2 class="text-[clamp(1.8rem,4vw,2.6rem)] font-bold text-navy">
				{m.features_heading()}
			</h2>
		</div>

		<div class="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-6">
			{#each features as feature (feature.title)}
				<article
					class="border-l-4 border-red bg-navy p-8 text-paper transition-transform duration-150 hover:-translate-y-1"
				>
					<div class="mb-3 text-[2rem]" aria-hidden="true">{feature.icon}</div>
					<h3 class="mb-[0.6rem] text-[1.1rem] font-bold text-yellow">{feature.title}</h3>
					<p class="text-[0.92rem] leading-[1.65] text-paper/80">{feature.body}</p>
				</article>
			{/each}
		</div>
	</div>
</section>

<!-- Opinions ---------------------------------------------------------------->
{#if opinions.length > 0}
	<section class="overflow-hidden bg-blue px-6 py-20">
		<div class="mx-auto max-w-[1100px]">
			<div class="mb-12">
				<div class="section-rule bg-yellow"></div>
				<h2 class="text-[clamp(1.8rem,4vw,2.6rem)] font-bold text-paper">
					{m.opinions_heading()}
				</h2>
			</div>

			<OpinionsCarousel {opinions} />
		</div>
	</section>
{/if}

<!-- Closing call to action -------------------------------------------------->
<section class="bg-red px-6 py-16 text-center">
	<h2 class="mb-4 text-[clamp(1.6rem,4vw,2.4rem)] font-bold text-paper">
		{m.home_cta_heading()}
	</h2>
	<p class="mb-8 text-[1.05rem] text-paper/90">{m.home_cta_body()}</p>
	<a href={localizeHref('/kontakt')} class="btn btn-yellow px-10 py-4 text-[1.05rem]">
		{m.home_cta_button()}
	</a>
</section>

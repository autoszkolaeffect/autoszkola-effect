<script lang="ts">
	import { getSmtpForAdmin, saveSmtpSettings, sendSmtpTest } from '#lib/remote/admin-smtp.remote';
	import AdminPage from '#lib/components/admin/AdminPage.svelte';
	import AdminCard from '#lib/components/admin/AdminCard.svelte';
	import AdminField from '#lib/components/admin/AdminField.svelte';
	import * as m from '#lib/paraglide/messages';

	// Port 465 is wrapped in TLS from the first byte; 587 starts in the clear and
	// upgrades with STARTTLS. Getting the pair wrong is the usual reason a
	// correctly-typed password still fails to send.
	const IMPLICIT_TLS_PORT = 465;
	const STARTTLS_PORT = 587;

	// Derived rather than awaited once: saving refreshes this query, and the form
	// falls back to it for every input's default once the fields are no longer
	// dirty - so a snapshot would blank the form after a save and leave `canTest`
	// saying the settings had never been stored.
	const smtp = $derived(await getSmtpForAdmin());

	const fields = saveSmtpSettings.fields;

	let testResult = $state<Awaited<ReturnType<typeof sendSmtpTest>> | undefined>();

	const saving = $derived(saveSmtpSettings.pending > 0);
	const saved = $derived(!saving && saveSmtpSettings.result?.ok === true);
	const testing = $derived(sendSmtpTest.pending > 0);

	const passwordHint = $derived(
		smtp.hasPassword ? m.admin_smtp_password_set() : m.admin_smtp_password_unset()
	);

	const serverSection = m.admin_smtp_section_server();
	const senderSection = m.admin_smtp_section_sender();
	const testSection = m.admin_smtp_section_test();
	const testNeedsSave = m.admin_smtp_test_needs_save();

	/**
	 * Moves the encryption toggle to match the port, because the two are only
	 * ever wrong together. It is a default rather than a rule - the operator can
	 * flip the toggle straight back and the port is left alone.
	 */
	function portChanged(port: number) {
		if (port === IMPLICIT_TLS_PORT) fields.secure.set(true);
		else if (port === STARTTLS_PORT) fields.secure.set(false);
	}

	async function runTest() {
		testResult = undefined;

		try {
			testResult = await sendSmtpTest();
		} catch (error) {
			// A rejected SMTP handshake comes back in the result, so reaching here
			// means the request itself never landed - an expired session, or the
			// network.
			testResult = { ok: false, error: error instanceof Error ? error.message : String(error) };
		}
	}
</script>

<AdminPage title={m.admin_smtp_title()} intro={m.admin_smtp_intro()}>
	<form {...saveSmtpSettings} class="flex flex-col gap-6">
		<AdminCard>
			<label class="flex items-start gap-3">
				<input
					{...fields.enabled.as('checkbox', smtp.enabled)}
					class="mt-nudge size-4 shrink-0 rounded-none border border-white/20 bg-navy text-red focus:ring-0"
				/>
				<span class="text-body leading-normal text-paper">{m.admin_smtp_enabled()}</span>
			</label>

			<p class="mt-3 text-meta leading-card text-paper/55">
				{m.admin_smtp_disabled_hint()}
			</p>
		</AdminCard>

		<AdminCard title={serverSection}>
			<div class="flex flex-col gap-5">
				<div class="grid grid-fields gap-5">
					<AdminField label={m.admin_smtp_host()} issues={fields.host.issues()}>
						{#snippet children(id, aria)}
							<input
								{id}
								{...fields.host.as('text', smtp.host)}
								{...aria}
								class="field"
								placeholder="smtp.example.com"
								autocomplete="off"
								spellcheck="false"
							/>
						{/snippet}
					</AdminField>

					<AdminField label={m.admin_smtp_port()} issues={fields.port.issues()}>
						{#snippet children(id, aria)}
							<input
								{id}
								{...fields.port.as('number', smtp.port)}
								{...aria}
								oninput={(event) => portChanged(event.currentTarget.valueAsNumber)}
								class="field"
								min="1"
								max="65535"
								inputmode="numeric"
								autocomplete="off"
							/>
						{/snippet}
					</AdminField>
				</div>

				<div>
					<label class="flex items-start gap-3">
						<input
							{...fields.secure.as('checkbox', smtp.secure)}
							class="mt-nudge size-4 shrink-0 rounded-none border border-white/20 bg-navy text-red focus:ring-0"
						/>
						<span class="text-body leading-normal text-paper">{m.admin_smtp_secure()}</span>
					</label>

					<p class="mt-3 text-meta leading-card text-paper/55">
						{m.admin_smtp_secure_hint()}
					</p>
				</div>

				<div class="grid grid-fields-wide gap-5">
					<AdminField label={m.admin_smtp_username()} issues={fields.username.issues()}>
						{#snippet children(id, aria)}
							<input
								{id}
								{...fields.username.as('text', smtp.username)}
								{...aria}
								class="field"
								autocomplete="off"
								spellcheck="false"
							/>
						{/snippet}
					</AdminField>

					<!-- Never prefilled, not even with a masked placeholder: the stored
					     password stays on the server, so the hint below carries the
					     "leaving this blank is safe" part instead. -->
					<AdminField
						label={m.admin_smtp_password()}
						hint={passwordHint}
						issues={fields.password.issues()}
					>
						{#snippet children(id, aria)}
							<input
								{id}
								{...fields.password.as('password')}
								{...aria}
								class="field"
								autocomplete="new-password"
							/>
						{/snippet}
					</AdminField>
				</div>
			</div>
		</AdminCard>

		<AdminCard title={senderSection}>
			<div class="flex flex-col gap-5">
				<div class="grid grid-fields-wide gap-5">
					<AdminField label={m.admin_smtp_from_name()} issues={fields.fromName.issues()}>
						{#snippet children(id, aria)}
							<input {id} {...fields.fromName.as('text', smtp.fromName)} {...aria} class="field" />
						{/snippet}
					</AdminField>

					<AdminField label={m.admin_smtp_from_address()} issues={fields.fromAddress.issues()}>
						{#snippet children(id, aria)}
							<input
								{id}
								{...fields.fromAddress.as('email', smtp.fromAddress)}
								{...aria}
								class="field"
								autocomplete="off"
								spellcheck="false"
							/>
						{/snippet}
					</AdminField>
				</div>

				<AdminField label={m.admin_smtp_to_address()} issues={fields.toAddress.issues()}>
					{#snippet children(id, aria)}
						<input
							{id}
							{...fields.toAddress.as('email', smtp.toAddress)}
							{...aria}
							class="field"
							autocomplete="off"
							spellcheck="false"
						/>
					{/snippet}
				</AdminField>
			</div>
		</AdminCard>

		<div class="flex flex-wrap items-center gap-4">
			<button type="submit" class="btn btn-red" disabled={saving}>
				{saving ? m.admin_saving() : m.admin_save()}
			</button>

			{#if saved}
				<p class="text-caption font-bold text-yellow" role="status">{m.admin_saved()}</p>
			{/if}
		</div>
	</form>

	<!-- Outside the form: the test sends the settings as they are stored, not as
	     they are typed, so it must not submit anything. -->
	<div class="mt-6">
		<AdminCard title={testSection}>
			<div class="flex flex-wrap items-center gap-4">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={runTest}
					disabled={testing || !smtp.canTest}
				>
					{testing ? m.admin_smtp_testing() : m.admin_smtp_test()}
				</button>

				{#if !smtp.canTest}
					<p class="text-meta leading-card text-paper/55">{testNeedsSave}</p>
				{/if}
			</div>

			{#if testResult}
				{#if testResult.ok}
					<p
						class="mt-5 border-l-3 border-yellow bg-navy px-4 py-3 text-caption leading-hint text-paper"
						role="status"
					>
						{m.admin_smtp_test_ok({ address: smtp.toAddress })}
					</p>
				{:else}
					<p
						class="mt-5 border-l-3 border-red bg-red/20 px-4 py-3 text-caption leading-hint text-paper"
						role="alert"
					>
						{m.admin_smtp_test_failed({ error: testResult.error })}
					</p>
				{/if}
			{/if}
		</AdminCard>
	</div>
</AdminPage>

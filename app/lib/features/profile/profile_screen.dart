import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/widgets.dart';
import '../../models/models.dart';
import '../auth/auth_providers.dart';
import 'cv_providers.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider);
    final cvs = ref.watch(cvsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authProvider).signOut(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _pickAndUpload(context, ref),
        icon: const Icon(Icons.upload_file),
        label: const Text('Add CV'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(profileProvider);
          ref.invalidate(cvsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          children: [
            profile.when(
              loading: () => const Card(child: ListTile(title: Skeleton(width: 180))),
              error: (e, _) => Card(child: ListTile(title: Text('$e'))),
              data: (p) => _ProfileCard(profile: p),
            ),
            const SizedBox(height: 24),
            Text('CVs', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            cvs.when(
              loading: () => const _CvSkeletons(),
              error: (e, _) => Card(child: ListTile(title: Text('$e'))),
              data: (list) => list.isEmpty
                  ? const EmptyState(
                      icon: Icons.description_outlined,
                      title: 'No CVs yet',
                      message: 'Upload a PDF or DOCX and JobPilot will pull out your skills.',
                    )
                  : Column(children: [for (final cv in list) _CvTile(cv: cv)]),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickAndUpload(BuildContext context, WidgetRef ref) async {
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'docx'],
      withData: true,
    );
    final file = picked?.files.single;
    if (file?.bytes == null) return;
    if (!context.mounted) return;

    final label = await _askLabel(context, file!.name);
    if (label == null || !context.mounted) return;

    final messenger = ScaffoldMessenger.of(context)
      ..showSnackBar(const SnackBar(content: Text('Uploading and parsing…')));
    try {
      await ref.read(cvRepositoryProvider).upload(
            label: label,
            fileName: file.name,
            bytes: file.bytes!,
          );
      messenger.hideCurrentSnackBar();
    } catch (e) {
      messenger.hideCurrentSnackBar();
      if (context.mounted) showError(context, e);
    }
  }

  Future<String?> _askLabel(BuildContext context, String fileName) {
    final controller = TextEditingController(text: fileName.split('.').first);
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Label this CV'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'e.g. Frontend CV'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Upload'),
          ),
        ],
      ),
    );
  }
}

class _ProfileCard extends ConsumerWidget {
  const _ProfileCard({required this.profile});

  final Profile profile;

  @override
  Widget build(BuildContext context, WidgetRef ref) => Card(
        child: Column(
          children: [
            ListTile(
              leading: CircleAvatar(
                foregroundImage: profile.photoUrl == null ? null : NetworkImage(profile.photoUrl!),
                child: const Icon(Icons.person_outline),
              ),
              title: Text(profile.fullName ?? 'Your profile'),
              subtitle: Text(profile.headline ?? 'No headline yet'),
              trailing: profile.linkedinConnected
                  ? const Chip(label: Text('LinkedIn'), visualDensity: VisualDensity.compact)
                  : null,
            ),
            const Divider(height: 1),
            ListTile(
              title: const Text('Daily send cap'),
              subtitle: const Text('Maximum application emails per day'),
              trailing: Text('${profile.dailySendCap}', style: Theme.of(context).textTheme.titleMedium),
            ),
            Slider(
              value: profile.dailySendCap.toDouble(),
              min: 1,
              max: 50,
              divisions: 49,
              label: '${profile.dailySendCap}',
              onChanged: (v) {}, // committed on release to avoid a write per pixel
              onChangeEnd: (v) => ref.read(cvRepositoryProvider).setDailySendCap(v.round()),
            ),
          ],
        ),
      );
}

class _CvTile extends ConsumerWidget {
  const _CvTile({required this.cv});

  final Cv cv;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final parsed = cv.parsedJson;
    return Card(
      child: ExpansionTile(
        leading: const Icon(Icons.description_outlined),
        title: Text(cv.label),
        subtitle: Text(
          parsed == null
              ? 'Not parsed yet'
              : '${parsed.skills.length} skills · ${parsed.yearsExperience} yrs experience',
        ),
        children: [
          if (parsed == null)
            ListTile(
              title: const Text('Parsing did not complete'),
              trailing: TextButton(
                onPressed: () async {
                  try {
                    await ref.read(cvRepositoryProvider).parse(cv.id);
                  } catch (e) {
                    if (context.mounted) showError(context, e);
                  }
                },
                child: const Text('Retry'),
              ),
            )
          else ...[
            if (parsed.summary.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Text(parsed.summary),
              ),
            if (parsed.skills.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final s in parsed.skills)
                      Chip(label: Text(s), visualDensity: VisualDensity.compact),
                  ],
                ),
              ),
            for (final role in parsed.roles)
              ListTile(dense: true, leading: const Icon(Icons.work_outline), title: Text(role)),
            for (final ed in parsed.education)
              ListTile(dense: true, leading: const Icon(Icons.school_outlined), title: Text(ed)),
          ],
          Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: TextButton.icon(
                onPressed: () => ref.read(cvRepositoryProvider).delete(cv),
                icon: const Icon(Icons.delete_outline),
                label: const Text('Delete'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CvSkeletons extends StatelessWidget {
  const _CvSkeletons();

  @override
  Widget build(BuildContext context) => const Column(
        children: [
          Card(child: ListTile(title: Skeleton(width: 140), subtitle: Skeleton(width: 90, height: 12))),
          Card(child: ListTile(title: Skeleton(width: 180), subtitle: Skeleton(width: 70, height: 12))),
        ],
      );
}

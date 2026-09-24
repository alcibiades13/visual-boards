import { useT } from '@/i18n';
import { Button } from './Button';
import { useConfirmStore } from './confirmStore';
import { Modal } from './Modal';

export function ConfirmHost() {
  const t = useT();
  const request = useConfirmStore((s) => s.request);
  if (!request) return null;
  const close = (ok: boolean) => {
    useConfirmStore.setState({ request: null });
    request.resolve(ok);
  };
  return (
    <Modal
      title={request.title}
      onClose={() => close(false)}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant={request.danger ? 'danger' : 'primary'} onClick={() => close(true)} data-autofocus>
            {request.confirmLabel}
          </Button>
        </>
      }
    >
      {request.body && <p className="text-muted">{request.body}</p>}
    </Modal>
  );
}

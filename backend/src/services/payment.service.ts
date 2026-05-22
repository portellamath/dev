import { PaymentStatus, OrderStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AuditRepository } from '../repositories/audit.repository';
import { OrderRepository } from '../repositories/order.repository';
import { AppError } from '../utils/AppError';
import { logPayment } from '../config/logger';

// Interface para gateway de pagamento (Strategy Pattern)
interface PaymentGatewayResult {
  gatewayId: string;
  status: PaymentStatus;
  metadata?: Record<string, unknown>;
}

export class PaymentService {
  private auditRepo = new AuditRepository();
  private orderRepo = new OrderRepository();

  // Simula processamento (substituir por Stripe, PagSeguro, etc.)
  private async processWithGateway(
    method: string,
    amount: number,
  ): Promise<PaymentGatewayResult> {
    // TODO: Integrar com gateway real (Stripe, PagSeguro, Mercado Pago)
    await new Promise((r) => setTimeout(r, 100)); // simula latência
    return {
      gatewayId: `gw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: PaymentStatus.PAID,
      metadata: { method, amount, processedAt: new Date() },
    };
  }

  async processPayment(orderId: string, userId: string) {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw AppError.notFound('Pedido não encontrado');

    if (order.userId !== userId) throw AppError.forbidden('Acesso negado');

    if (!order.payment) throw AppError.badRequest('Pagamento não encontrado');

    if (order.payment.status === PaymentStatus.PAID) {
      throw AppError.conflict('Pagamento já processado');
    }

    if (order.payment.status === PaymentStatus.FAILED) {
      throw AppError.badRequest('Pagamento falhou. Crie um novo pedido.');
    }

    logPayment('PAYMENT_PROCESSING', orderId, { userId, amount: order.payment.amount });

    try {
      const result = await this.processWithGateway(
        order.payment.method,
        Number(order.payment.amount),
      );

      const updatedPayment = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.update({
          where: { orderId },
          data: {
            status: result.status,
            gatewayId: result.gatewayId,
            gatewayResponse: result.metadata as object,
            paidAt: result.status === PaymentStatus.PAID ? new Date() : undefined,
          },
        });

        if (result.status === PaymentStatus.PAID) {
          await tx.order.update({
            where: { id: orderId },
            data: { status: OrderStatus.CONFIRMED },
          });
        }

        return payment;
      });

      await this.auditRepo.create({
        actorId: userId,
        action: 'PAYMENT_PROCESSED',
        resource: 'Payment',
        resourceId: updatedPayment.id,
        newData: {
          orderId,
          status: result.status,
          gatewayId: result.gatewayId,
        },
      });

      logPayment('PAYMENT_PROCESSED', orderId, {
        status: result.status,
        gatewayId: result.gatewayId,
        userId,
      });

      return updatedPayment;
    } catch (error) {
      await prisma.payment.update({
        where: { orderId },
        data: {
          status: PaymentStatus.FAILED,
          failedAt: new Date(),
          gatewayResponse: { error: String(error) },
        },
      });

      logPayment('PAYMENT_FAILED', orderId, { userId, error: String(error) });
      throw AppError.badRequest('Falha ao processar pagamento');
    }
  }

  async handleWebhook(payload: Record<string, unknown>, signature: string) {
    // TODO: validar assinatura do webhook do gateway
    logPayment('WEBHOOK_RECEIVED', String(payload.orderId ?? 'unknown'), { payload });

    const { orderId, status, gatewayId } = payload as {
      orderId: string;
      status: string;
      gatewayId: string;
    };

    if (!orderId || !status) {
      throw AppError.badRequest('Payload de webhook inválido');
    }

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    if (!payment) {
      throw AppError.notFound('Pagamento não encontrado');
    }

    const paymentStatus = status.toUpperCase() as PaymentStatus;

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: paymentStatus,
          gatewayId,
          paidAt: paymentStatus === PaymentStatus.PAID ? new Date() : undefined,
          failedAt: paymentStatus === PaymentStatus.FAILED ? new Date() : undefined,
          refundedAt: paymentStatus === PaymentStatus.REFUNDED ? new Date() : undefined,
        },
      });

      if (paymentStatus === PaymentStatus.PAID) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.CONFIRMED },
        });
      }
    });

    logPayment('WEBHOOK_PROCESSED', orderId, { status, gatewayId });
    return { processed: true };
  }

  async getPaymentByOrderId(orderId: string, userId: string) {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw AppError.notFound('Pedido não encontrado');
    if (order.userId !== userId) throw AppError.forbidden('Acesso negado');

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    if (!payment) throw AppError.notFound('Pagamento não encontrado');

    return payment;
  }
}
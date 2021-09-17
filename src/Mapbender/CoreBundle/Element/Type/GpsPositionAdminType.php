<?php

namespace Mapbender\CoreBundle\Element\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class GpsPositionAdminType extends AbstractType
{

    public function getParent()
    {
        return 'Mapbender\CoreBundle\Element\Type\BaseButtonAdminType';
    }

    /**
     * @inheritdoc
     */
    public function configureOptions(OptionsResolver $resolver)
    {
        $resolver->setDefaults(array(
            'application' => null,
            'average'     => 1,
        ));
    }

    /**
     * @inheritdoc
     */
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add('autoStart', 'Symfony\Component\Form\Extension\Core\Type\CheckboxType', array(
                'required' => false,
                'label' => 'mb.core.admin.element.autostart',
            ))
            ->add('target',  'Mapbender\CoreBundle\Element\Type\TargetElementType', array(
                'element_class' => 'Mapbender\\CoreBundle\\Element\\Map',
                'application' => $options['application'],
                'required' => false,
            ))
            ->add('average', 'Symfony\Component\Form\Extension\Core\Type\TextType', array(
                'required' => false,
            ))
            ->add('follow', 'Symfony\Component\Form\Extension\Core\Type\CheckboxType', array(
                'required' => false,
            ))
            ->add('centerOnFirstPosition', 'Symfony\Component\Form\Extension\Core\Type\CheckboxType', array(
                'required' => false,
            ))
            ->add('zoomToAccuracyOnFirstPosition', 'Symfony\Component\Form\Extension\Core\Type\CheckboxType', array(
                'required' => false,
            ))
        ;
    }
}
